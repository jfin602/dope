import * as ts from 'typescript';
import type { FrameworkFact } from '@dope/code-analysis';

export interface FrameworkEvidenceExtractor {
    readonly framework: string;
    readonly producer: string;
    readonly producerVersion: string;
    extract(file: ts.SourceFile, checker: ts.TypeChecker, options: ts.CompilerOptions,
        emit: (node: ts.Node, fact: Omit<FrameworkFact, 'kind' | 'path' | 'sourceEvidenceIds' | 'framework' | 'producer' | 'producerVersion'>) => void): void;
}

const property = (node: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined =>
    node.properties.find((part): part is ts.PropertyAssignment => ts.isPropertyAssignment(part) && part.name.getText(node.getSourceFile()) === name)?.initializer;
const identifier = (node: ts.Node | undefined): string | undefined =>
    node && (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) ? node.getText() : undefined;

/** Theia/Inversify source patterns only. Imported symbols must resolve to a real @theia package. */
export const theiaInversifyExtractor: FrameworkEvidenceExtractor = {
    framework: 'theia/inversify', producer: '@dope/code-analysis-typescript/theia-inversify', producerVersion: '1',
    extract(file, checker, options, emit) {
        const imports = new Map<string, { name: string; module: string; symbol: ts.Symbol }>();
        for (const statement of file.statements) {
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
                !statement.moduleSpecifier.text.startsWith('@theia/')) continue;
            const module = statement.moduleSpecifier.text;
            const resolved = ts.resolveModuleName(module, file.fileName, options, ts.sys).resolvedModule?.resolvedFileName.replaceAll('\\', '/');
            if (!resolved?.includes(`/node_modules/${module.split('/').slice(0, 2).join('/')}/`)) continue;
            const bindings = statement.importClause?.namedBindings;
            if (bindings && ts.isNamedImports(bindings)) for (const specifier of bindings.elements) {
                const name = specifier.propertyName?.text ?? specifier.name.text;
                const symbol = checker.getSymbolAtLocation(specifier.name);
                if (!symbol) continue;
                imports.set(specifier.name.text, { name, module, symbol });
                emit(specifier, { concept: 'import', name, target: module, detail: true });
            }
        }
        const imported = (node: ts.Node | undefined, name: string, module: string): boolean => {
            if (!node || !ts.isIdentifier(node)) return false;
            const match = imports.get(node.text);
            return match?.name === name && match.module === module && checker.getSymbolAtLocation(node) === match.symbol;
        };
        const core = '@theia/core/lib/browser';
        const string = (node: ts.Expression | undefined, seen = new Set<ts.Symbol>()): string | undefined => {
            if (!node) return undefined;
            if (ts.isStringLiteralLike(node)) return node.text;
            if (!ts.isIdentifier(node)) return undefined;
            let symbol = checker.getSymbolAtLocation(node);
            if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
            if (!symbol || seen.has(symbol)) return undefined;
            seen.add(symbol);
            const declaration = symbol.declarations?.find(ts.isVariableDeclaration);
            return declaration?.initializer ? string(declaration.initializer, seen) : undefined;
        };
        const callName = (node: ts.Node): string | undefined => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text : undefined;
        const extractBinding = (node: ts.Node, bindings: Map<ts.Symbol, string>): void => {
            if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
            const method = node.expression.name.text;
            if (!['to', 'toSelf', 'toService', 'toDynamicValue', 'toConstantValue'].includes(method)) return;
            const registration = node.expression.expression;
            if (!ts.isCallExpression(registration) || !ts.isIdentifier(registration.expression) || registration.arguments.length !== 1) return;
            const role = bindings.get(checker.getSymbolAtLocation(registration.expression)!);
            if (!role) return;
            const service = identifier(registration.arguments[0]);
            if (!service) return;
            const target = method === 'toSelf' ? service : method === 'to' || method === 'toService' ? identifier(node.arguments[0]) : undefined;
            emit(node, { concept: 'di-registration', name: service, role,
                ...(target ? { target } : {}) });
            if (service === 'WidgetFactory' && imported(registration.arguments[0], 'WidgetFactory', core)) {
                const object = node.arguments[0] && find(node.arguments[0], ts.isObjectLiteralExpression);
                const widgetId = object && string(property(object, 'id'));
                const created = object && find(property(object, 'createWidget'), ts.isNewExpression);
                if (widgetId && created) emit(node, { concept: 'widget-factory', name: widgetId,
                    ...(identifier(created.expression) ? { target: identifier(created.expression) } : {}) });
            }
        };
        const visit = (node: ts.Node): void => {
            if (ts.isNewExpression(node) && imported(node.expression, 'ContainerModule', '@theia/core/shared/inversify')) {
                emit(node, { concept: 'container-module', name: file.fileName.split(/[\\/]/).pop()! });
                const callback = node.arguments?.[0];
                if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
                    const bindSymbols = new Map<ts.Symbol, string>();
                    for (const [index, role] of [[0, 'bind'], [3, 'rebind']] as const) {
                        const parameter = callback.parameters[index];
                        if (parameter && ts.isIdentifier(parameter.name)) {
                            const symbol = checker.getSymbolAtLocation(parameter.name);
                            if (symbol) bindSymbols.set(symbol, role);
                        }
                    }
                    const registrations = (child: ts.Node): void => { extractBinding(child, bindSymbols); ts.forEachChild(child, registrations); };
                    registrations(callback.body);
                }
            }
            if (ts.isNewExpression(node) && imported(node.expression, 'RpcConnectionHandler', '@theia/core/lib/common')) {
                const path = string(node.arguments?.[0]);
                emit(node, { concept: 'rpc-handler', name: identifier(node.arguments?.[0]) ?? path ?? 'RPC',
                    ...(path ? { servicePath: path } : {}) });
            }
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'createProxy' && imported(node.expression.expression, 'ServiceConnectionProvider',
                    '@theia/core/lib/browser/messaging/service-connection-provider')) {
                const path = string(node.arguments[1]);
                emit(node, { concept: 'frontend-proxy', name: identifier(node.arguments[1]) ?? path ?? 'proxy',
                    ...(path ? { servicePath: path } : {}) });
            }
            if (ts.isCallExpression(node) && imported(node.expression, 'bindViewContribution',
                '@theia/core/lib/browser/shell/view-contribution')) {
                const target = identifier(node.arguments[1]);
                if (target) emit(node, { concept: 'view-contribution', name: target });
            }
            if (ts.isClassDeclaration(node) && node.name) {
                const base = node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression;
                if (imported(base, 'AbstractViewContribution', core)) {
                    let metadata: ts.ObjectLiteralExpression | undefined;
                    const constructor = node.members.find(ts.isConstructorDeclaration);
                    if (constructor) metadata = find(constructor.body, (child): child is ts.ObjectLiteralExpression =>
                        ts.isObjectLiteralExpression(child) && !!property(child, 'widgetId'));
                    const widgetId = metadata && string(property(metadata, 'widgetId'));
                    const area = metadata && property(metadata, 'defaultWidgetOptions');
                    const widgetArea = area && ts.isObjectLiteralExpression(area) ? string(property(area, 'area')) : undefined;
                    emit(node, { concept: 'view', name: node.name.text,
                        ...(widgetId ? { target: widgetId } : {}), ...(widgetArea ? { widgetArea } : {}) });
                }
                for (const clause of node.heritageClauses ?? []) if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
                    for (const type of clause.types) if (imported(type.expression, 'FrontendApplicationContribution', core)) {
                        emit(type, { concept: 'frontend-application-contribution', name: node.name.text });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    },
};

function find<T extends ts.Node>(node: ts.Node | undefined, predicate: (node: ts.Node) => node is T): T | undefined {
    if (!node) return undefined;
    if (predicate(node)) return node;
    return ts.forEachChild(node, child => find(child, predicate));
}
