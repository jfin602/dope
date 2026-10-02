import { readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import * as ts from 'typescript';
import { anonymousCallableId, derivedId, flowFactId, relationshipId } from '@dope/software-map';
import type { AnalysisError, CodeEntityNode, Evidence, GraphRelationship, PhysicalFlowFact } from '@dope/software-map';
import type { CodeAnalysisResult, CodeAnalyzer, AnalysisProject, FrameworkFact } from '@dope/code-analysis';
import { theiaInversifyExtractor } from './framework-extractor';
import { extractFlowBoundaries } from './flow-extractor';

const PRODUCER = '@dope/code-analysis-typescript';
const VERSION = '5.9.3';
const compilerLib = (() => {
    try { return dirname(createRequire(__filename).resolve('typescript')); }
    catch { return join((process as NodeJS.Process & { resourcesPath: string }).resourcesPath, 'app/typescript/lib'); }
})();
const ignored = new Set(['node_modules', '.git', '.dope', '.theia', 'plugins', 'dist', 'build', 'out', 'coverage', 'generated', 'vendor']);
const sourceFile = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const declarationFile = /\.d\.[cm]?ts$/i;
const named = (node: ts.Node): node is ts.Node & { name: ts.Node } => 'name' in node && !!(node as { name?: ts.Node }).name;
const dopeOwned = (root: string, file: string): boolean => {
    const path = relative(root, resolve(file)).replaceAll('\\', '/');
    return !!path && path !== '..' && !path.startsWith('../') && path.split('/').includes('.dope');
};

/** Full rebuild; P3 owns generation, caching and cancellation. */
export class TypeScriptAnalyzer implements CodeAnalyzer {
    private readonly sourceCache = new Map<string, Map<string, { text: string; file: ts.SourceFile }>>();

    /** Cheap configured inputs for exact fingerprinting, including newly included files. */
    inputPaths(projectRoot: string): { sources: string[]; configs: string[] } {
        const root = resolve(projectRoot);
        const within = (file: string): boolean => {
            const path = relative(root, resolve(file)).replaceAll('\\', '/');
            return !!path && path !== '..' && !path.startsWith('../') && !isAbsolute(path) && !dopeOwned(root, file);
        };
        const configHost = { ...ts.sys, readFile: (file: string) => dopeOwned(root, file) ? undefined : ts.sys.readFile(file) };
        const configs = new Set<string>();
        const configFiles = new Set<string>();
        const sources = new Set<string>();
        const discover = (dir: string): void => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const path = resolve(dir, entry.name);
                if (entry.isDirectory() && !ignored.has(entry.name)) discover(path);
                else if (entry.isFile() && /^(tsconfig|jsconfig)(?:\.[^/]*)?\.json$/.test(entry.name)) configs.add(path);
                if (entry.isFile() && entry.name.endsWith('.json')) configFiles.add(path);
            }
        };
        discover(root);
        const queue = [...configs];
        for (let i = 0; i < queue.length; i++) {
            const config = queue[i];
            const read = ts.readConfigFile(config, ts.sys.readFile);
            if (read.error) continue;
            const parsed = ts.parseJsonConfigFileContent(read.config, configHost, resolve(config, '..'), undefined, config);
            for (const file of parsed.fileNames) {
                if (within(file) && sourceFile.test(file)) sources.add(resolve(file));
            }
            for (const reference of parsed.projectReferences ?? []) {
                const path = ts.resolveProjectReferencePath(reference);
                if (!configs.has(path) && within(path)) { configs.add(path); queue.push(path); }
            }
        }
        return { sources: [...sources].sort(), configs: [...new Set([...configFiles, ...configs])].sort() };
    }

    reset(projectRoot: string): void {
        const prefix = `${resolve(projectRoot)}\0`;
        for (const key of this.sourceCache.keys()) if (key.startsWith(prefix)) this.sourceCache.delete(key);
    }

    analyze(projectRoot: string): CodeAnalysisResult {
        const root = resolve(projectRoot);
        const configHost = { ...ts.sys, readFile: (file: string) => dopeOwned(root, file) ? undefined : ts.sys.readFile(file) };
        let reusedSourceFiles = 0;
        const nodes = new Map<string, CodeEntityNode>();
        const relationships = new Map<string, GraphRelationship>();
        const evidence = new Map<string, Evidence>();
        const frameworkFacts = new Map<string, FrameworkFact>();
        const flowFacts = new Map<string, PhysicalFlowFact>();
        const flowEndpoints = new Map<string, import('@dope/software-map').PhysicalFlowEndpoint>();
        const flowDiagnostics = new Map<string, import('@dope/software-map').FlowDiagnostic>();
        const errors = new Map<string, AnalysisError>();
        const projects: AnalysisProject[] = [];
        const configs = new Set<string>();
        const paths = new Set<string>();
        const programs: Array<{ program: ts.Program; files: ts.SourceFile[]; options: ts.CompilerOptions }> = [];
        const pathOf = (file: string): string | undefined => {
            const path = relative(root, resolve(file)).replaceAll('\\', '/');
            return path && path !== '..' && !path.startsWith('../') && !isAbsolute(path) && !dopeOwned(root, file) ? path : undefined;
        };
        const report = (code: string, message: string, path?: string): void => {
            const item = { producer: PRODUCER, code, message, ...(path ? { path } : {}) };
            errors.set(JSON.stringify(item), item);
        };
        const span = (file: ts.SourceFile, node: ts.Node) => {
            const start = node.getStart(file);
            const position = file.getLineAndCharacterOfPosition(start);
            return { start, length: node.getWidth(file), line: position.line + 1, column: position.character + 1 };
        };
        const addEvidence = (kind: Evidence['class'], file: ts.SourceFile, node: ts.Node, key: string,
            producer = PRODUCER, producerVersion = VERSION): string => {
            const path = pathOf(file.fileName)!;
            const location = span(file, node);
            const id = `evidence:${encodeURIComponent([kind, path, location.start, location.length, key].join(':'))}`;
            evidence.set(id, { id, class: kind, producer, producerVersion, path, span: location });
            return id;
        };
        const addNode = (id: string, path: string, name: string, codeKind: CodeEntityNode['codeKind'], analyzerKind: string, parentId: string | undefined, evidenceId: string): void => {
            const prior = nodes.get(id);
            if (prior) {
                if (!prior.evidenceIds.includes(evidenceId)) prior.evidenceIds.push(evidenceId);
                return;
            }
            nodes.set(id, { id, kind: 'code', codeKind, language: /\.[cm]?jsx?$/.test(path) ? 'javascript' : 'typescript', analyzerKind,
                path, name, ...(codeKind === 'symbol' ? { symbol: name } : {}), ...(parentId ? { parentId } : {}),
                ownership: { state: 'unassigned' }, evidenceIds: [evidenceId] });
        };
        const addEdge = (kind: GraphRelationship['kind'], sourceId: string, targetId: string, file: ts.SourceFile, node: ts.Node): void => {
            const id = relationshipId(kind, sourceId, targetId);
            const evidenceId = addEvidence(kind === 'contains' ? 'syntax' : 'semantic', file, node, id);
            const prior = relationships.get(id);
            if (prior) { if (!prior.evidenceIds.includes(evidenceId)) prior.evidenceIds.push(evidenceId); }
            else relationships.set(id, { id, kind, sourceId, targetId, evidenceIds: [evidenceId] });
        };
        const visitConfigs = (dir: string): void => {
            let entries;
            try { entries = readdirSync(dir, { withFileTypes: true }); }
            catch (error) { report('discovery', String(error), pathOf(dir)); return; }
            for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
                const file = resolve(dir, entry.name);
                if (entry.isDirectory() && !ignored.has(entry.name)) visitConfigs(file);
                else if (entry.isFile() && /^(tsconfig|jsconfig)(?:\.[^/]*)?\.json$/.test(entry.name)) configs.add(file);
            }
        };
        const configQueue: string[] = [];
        const parseConfig = (config: string): void => {
            if (configs.has(config)) return;
            if (!pathOf(config)) { report('config-outside-project', `Referenced config outside project: ${config}`); return; }
            configs.add(config);
            configQueue.push(config);
        };
        visitConfigs(root);
        configQueue.push(...[...configs].sort());
        for (let index = 0; index < configQueue.length; index++) {
            const config = configQueue[index];
            const configPath = pathOf(config);
            if (!configPath) continue;
            try {
                const read = ts.readConfigFile(config, ts.sys.readFile);
                if (read.error) { report('config', ts.flattenDiagnosticMessageText(read.error.messageText, '\n'), configPath); continue; }
                const parsed = ts.parseJsonConfigFileContent(read.config, configHost, resolve(config, '..'), undefined, config);
                for (const reference of parsed.projectReferences ?? []) parseConfig(ts.resolveProjectReferencePath(reference));
                for (const diagnostic of parsed.errors) report(`TS${diagnostic.code}`, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), configPath);
                const configuredFiles = parsed.fileNames.filter(file => !!pathOf(file) && sourceFile.test(file));
                const fileNames = configuredFiles.filter(file => !declarationFile.test(file));
                const sourcePaths = fileNames.map(file => pathOf(file)!).sort();
                projects.push({ configPath, sourcePaths });
                fileNames.forEach(file => paths.add(resolve(file)));
                // Analyze referenced source directly; an unbuilt composite project's .d.ts is not required.
                const options = { ...parsed.options, noEmit: true, composite: false };
                const cacheKey = `${root}\0${configPath}`;
                const cache = this.sourceCache.get(cacheKey) ?? new Map<string, { text: string; file: ts.SourceFile }>();
                const host = ts.createCompilerHost(options);
                host.getDefaultLibLocation = () => compilerLib;
                host.getDefaultLibFileName = options => join(compilerLib, ts.getDefaultLibFileName(options));
                const originalGet = host.getSourceFile.bind(host);
                const analyzable = new Set(fileNames);
                const reused = new Set<string>();
                host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
                    if (!analyzable.has(file)) return originalGet(file, languageVersion, onError, shouldCreateNewSourceFile);
                    const text = ts.sys.readFile(file);
                    if (text === undefined) return undefined;
                    const prior = cache.get(file);
                    if (!shouldCreateNewSourceFile && prior?.text === text) { reused.add(file); return prior.file; }
                    const parsed = originalGet(file, languageVersion, onError, shouldCreateNewSourceFile);
                    if (parsed) cache.set(file, { text, file: parsed });
                    return parsed;
                };
                const program = ts.createProgram({ rootNames: configuredFiles, options, host });
                reusedSourceFiles += reused.size;
                for (const file of cache.keys()) if (!analyzable.has(file)) cache.delete(file);
                this.sourceCache.set(cacheKey, cache);
                const files = fileNames.map(file => program.getSourceFile(file));
                fileNames.forEach((file, index) => { if (!files[index]) report('missing-source', `Compiler did not load ${pathOf(file)}`, configPath); });
                programs.push({ program, options, files: files.filter((file): file is ts.SourceFile => !!file) });
                for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
                    const diagnosticPath = diagnostic.file && pathOf(diagnostic.file.fileName);
                    if (diagnostic.file && !diagnosticPath) continue;
                    const location = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) : undefined;
                    report(`TS${diagnostic.code}`, `${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}${location ? ` (${location.line + 1}:${location.character + 1})` : ''}`, diagnosticPath ?? configPath);
                }
            } catch (error) { report('analysis-failure', String(error), configPath); }
        }
        if (!configs.size) report('no-config', 'No tsconfig/jsconfig project found');
        const included = new Set([...paths].map(file => pathOf(file)!));
        const fileIds = new Map<string, string>();
        const moduleIds = new Map<string, string>();
        for (const { files } of programs) for (const file of files) {
            const path = pathOf(file.fileName)!;
            if (fileIds.has(path)) continue;
            const fileId = derivedId('file', path);
            const moduleId = derivedId('module', path);
            fileIds.set(path, fileId);
            moduleIds.set(path, moduleId);
            addNode(fileId, path, path, 'file', 'source-file', undefined, addEvidence('syntax', file, file, fileId));
            addNode(moduleId, path, path, 'module', 'module', fileId, addEvidence('syntax', file, file, moduleId));
            addEdge('contains', fileId, moduleId, file, file);
        }
        const symbolId = (symbol: ts.Symbol | undefined): string | undefined => {
            if (!symbol) return undefined;
            const declarations = (symbol.declarations ?? []).filter(declaration => included.has(pathOf(declaration.getSourceFile().fileName) ?? ''));
            const candidates = declarations.map(declaration => {
                const file = declaration.getSourceFile();
                const path = pathOf(file.fileName)!;
                const name = named(declaration) ? declaration.name.getText(file) : symbol.name;
                return { declaration, file, path, name };
            }).sort((a, b) => a.path.localeCompare(b.path) || a.declaration.getStart(a.file) - b.declaration.getStart(b.file));
            const first = candidates[0];
            if (!first) return undefined;
            const declaration = first.declaration;
            const supported = ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration) || ts.isFunctionDeclaration(declaration) ||
                ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration) || ts.isVariableDeclaration(declaration) ||
                ts.isEnumDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration);
            if (!supported) return undefined;
            const ownerName = (ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration)) && named(declaration.parent)
                ? declaration.parent.name.getText(first.file) : undefined;
            const qualified = ownerName ? `${ownerName}.${first.name}` : first.name;
            const id = derivedId('symbol', first.path, `${qualified}@${declaration.getStart(first.file)}`);
            const parentId = ownerName && named(declaration.parent)
                ? symbolIdFromDeclaration(declaration.parent, first.file) ?? moduleIds.get(first.path)! : moduleIds.get(first.path)!;
            const kind = ts.isClassDeclaration(declaration) ? 'class' : ts.isInterfaceDeclaration(declaration) ? 'interface' :
                ts.isFunctionDeclaration(declaration) ? 'function' : ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration) ? 'method' :
                ts.isEnumDeclaration(declaration) ? 'enum' : ts.isTypeAliasDeclaration(declaration) ? 'type' : 'variable';
            addNode(id, first.path, qualified, 'symbol', kind, parentId,
                addEvidence('syntax', first.file, declaration, id));
            addEdge('contains', parentId, id, first.file, declaration);
            return id;
        };
        const symbolIdFromDeclaration = (declaration: ts.Node & { name: ts.Node }, file: ts.SourceFile): string | undefined => {
            const symbol = programs.filter(({ program }) => program.getSourceFile(file.fileName) === file)
                .map(({ program }) => program.getTypeChecker().getSymbolAtLocation(declaration.name)).find(Boolean);
            return symbol ? symbolId(symbol) : undefined;
        };
        for (const { program, files, options } of programs) {
            const checker = program.getTypeChecker();
            const canonical = (symbol: ts.Symbol | undefined): ts.Symbol | undefined => symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
            const callableId = (declaration: ts.Node): string | undefined => {
                const file = declaration.getSourceFile();
                const path = pathOf(file.fileName);
                if (!path || !included.has(path)) return undefined;
                if ((ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) && declaration.body && named(declaration))
                    return symbolId(checker.getSymbolAtLocation(declaration.name));
                if (ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) {
                    const location = span(file, declaration);
                    const id = anonymousCallableId(path, location.start, location.length);
                    let parentId = moduleIds.get(path)!;
                    for (let parent = declaration.parent; parent && parent !== file; parent = parent.parent) {
                        if (ts.isFunctionLike(parent)) { parentId = callableId(parent) ?? parentId; break; }
                    }
                    addNode(id, path, `${path}:${location.line}:${location.column}`, 'other', 'anonymous-callable', parentId,
                        addEvidence('syntax', file, declaration, id));
                    addEdge('contains', parentId, id, file, declaration);
                    return id;
                }
                return undefined;
            };
            for (const file of files) {
                const path = pathOf(file.fileName)!;
                extractFlowBoundaries({ file, checker, root, callableId, addEvidence, evidence, flowFacts, flowEndpoints, flowDiagnostics });
                for (const extractor of [theiaInversifyExtractor]) extractor.extract(file, checker, options, (node, metadata) => {
                    const sourceEvidenceId = addEvidence('framework', file, node, `${metadata.concept}:${metadata.name}`, extractor.producer, extractor.producerVersion);
                    const fact: FrameworkFact = { kind: 'framework', path, sourceEvidenceIds: [sourceEvidenceId],
                        framework: extractor.framework, producer: extractor.producer, producerVersion: extractor.producerVersion, ...metadata };
                    frameworkFacts.set(JSON.stringify(fact), fact);
                });
                const moduleId = moduleIds.get(path)!;
                const resolveImport = (specifier: ts.StringLiteralLike, isExport: boolean): void => {
                    const target = ts.resolveModuleName(specifier.text, file.fileName, options, ts.sys).resolvedModule;
                    const targetPath = target && pathOf(target.resolvedFileName);
                    if (!target && specifier.text.startsWith('.') &&
                        (!/\.[^/]+$/.test(specifier.text) || sourceFile.test(specifier.text)))
                        report('unresolved-import', `Cannot resolve ${specifier.text}`, path);
                    else if (targetPath && included.has(targetPath)) addEdge(isExport ? 'exports' : 'imports', moduleId, moduleIds.get(targetPath)!, file, specifier);
                };
                const visit = (node: ts.Node): void => {
                    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
                        if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) resolveImport(node.moduleSpecifier, ts.isExportDeclaration(node));
                    }
                    if (ts.isCallExpression(node) && node.expression.getText(file) === 'require' && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
                        resolveImport(node.arguments[0], false);
                    }
                    if (ts.isCallExpression(node) && !(ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
                        const declaration = checker.getResolvedSignature(node)?.declaration;
                        const targetId = declaration && callableId(declaration);
                        let callerId: string | undefined = moduleId;
                        for (let parent = node.parent; parent && parent !== file; parent = parent.parent) {
                            if (ts.isFunctionLike(parent)) { callerId = callableId(parent); break; }
                        }
                        if (callerId && targetId) {
                            const discriminator = `${path}:${node.getStart(file)}:${node.getWidth(file)}`;
                            const id = flowFactId('invokes', callerId, targetId, discriminator);
                            const evidenceId = addEvidence('semantic', file, node, id);
                            evidence.get(evidenceId)!.flowKind = 'invokes';
                            let expression: ts.Node = node;
                            while (ts.isParenthesizedExpression(expression.parent)) expression = expression.parent;
                            const awaited = ts.isAwaitExpression(expression.parent) ? expression.parent : undefined;
                            const behaviorEvidenceId = awaited ? addEvidence('semantic', file, awaited, `${id}:async`) : undefined;
                            if (behaviorEvidenceId) evidence.get(behaviorEvidenceId)!.flowBehavior = 'async';
                            const fact: PhysicalFlowFact = { id, kind: 'invokes', sourceId: callerId, targetId, discriminator, evidenceIds: [evidenceId],
                                ...(behaviorEvidenceId ? { behavior: { async: true, evidenceIds: [behaviorEvidenceId] } } : {}) };
                            flowFacts.set(id, fact);
                        }
                    }
                    if (named(node) && (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isFunctionDeclaration(node) ||
                        ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isVariableDeclaration(node) ||
                        ts.isEnumDeclaration(node) || ts.isTypeAliasDeclaration(node))) symbolId(checker.getSymbolAtLocation(node.name));
                    if (ts.isIdentifier(node)) {
                        const parent = node.parent;
                        const declarationName = named(parent) && parent.name === node;
                        const inImportExport = !!node.parent && (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent));
                        if (!declarationName && !inImportExport) {
                            // Member names still resolve through the checker; unresolved globals remain compiler diagnostics.
                            const target = symbolId(canonical(checker.getSymbolAtLocation(node)));
                            if (target && target !== moduleId) addEdge('references', moduleId, target, file, node);
                        }
                    }
                    if (ts.isHeritageClause(node)) for (const type of node.types) {
                        const target = symbolId(canonical(checker.getSymbolAtLocation(type.expression)));
                        const source = named(node.parent) ? symbolId(checker.getSymbolAtLocation(node.parent.name)) : undefined;
                        if (source && target) addEdge(node.token === ts.SyntaxKind.ImplementsKeyword ? 'implements' : 'extends', source, target, file, type);
                    }
                    ts.forEachChild(node, visit);
                };
                visit(file);
                const moduleSymbol = checker.getSymbolAtLocation(file);
                if (moduleSymbol) for (const exported of checker.getExportsOfModule(moduleSymbol)) {
                    const target = symbolId(canonical(exported));
                    if (!target) continue;
                    const site = exported.declarations?.find(declaration => pathOf(declaration.getSourceFile().fileName) === path) ??
                        canonical(exported)?.declarations?.find(declaration => pathOf(declaration.getSourceFile().fileName) === path);
                    if (site) addEdge('exports', moduleId, target, file, site);
                }
            }
        }
        const ordered = <T extends { id: string }>(items: Iterable<T>): T[] => [...items].sort((a, b) => a.id.localeCompare(b.id));
        return { projects: projects.sort((a, b) => a.configPath.localeCompare(b.configPath)),
            nodes: ordered(nodes.values()).map(node => ({ ...node, evidenceIds: [...new Set(node.evidenceIds)].sort() })),
            relationships: ordered(relationships.values()).map(edge => ({ ...edge, evidenceIds: [...new Set(edge.evidenceIds)].sort() })),
            evidence: ordered(evidence.values()),
            flowFacts: ordered(flowFacts.values()), flowEndpoints: ordered(flowEndpoints.values()),
            flowCoverage: [...new Set([...flowDiagnostics.values()].map(item => item.scopeId).filter((id): id is string => !!id))]
                .sort().map(scopeId => ({ scopeId, status: 'partial' as const,
                    diagnosticIds: ordered([...flowDiagnostics.values()].filter(item => item.scopeId === scopeId)).map(item => item.id) })),
            flowDiagnostics: ordered(flowDiagnostics.values()),
            frameworkFacts: [...frameworkFacts.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
            status: { completeness: !projects.length ? 'failed' : errors.size || flowDiagnostics.size ? 'partial' : 'complete',
                errors: [...errors.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }, reusedSourceFiles };
    }
}
