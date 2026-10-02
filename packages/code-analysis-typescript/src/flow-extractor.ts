import * as ts from 'typescript';
import { relative } from 'node:path';
import { flowEndpointId, flowFactId } from '@dope/software-map';
import type { Evidence, FlowDiagnostic, FlowEndpointIdentity, FlowEndpointKind, FlowInteractionKind, PhysicalFlowEndpoint, PhysicalFlowFact } from '@dope/software-map';

interface Context {
    file: ts.SourceFile;
    checker: ts.TypeChecker;
    root: string;
    callableId: (declaration: ts.Node) => string | undefined;
    addEvidence: (kind: Evidence['class'], file: ts.SourceFile, node: ts.Node, key: string, producer?: string, producerVersion?: string) => string;
    evidence: Map<string, Evidence>;
    flowFacts: Map<string, PhysicalFlowFact>;
    flowEndpoints: Map<string, PhysicalFlowEndpoint>;
    flowDiagnostics: Map<string, FlowDiagnostic>;
}

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const source = (node: ts.Node | undefined): string => node?.getSourceFile().fileName.replaceAll('\\', '/') ?? '';

/** Provider-free source boundary extraction; framework architecture facts live elsewhere. */
export function extractFlowBoundaries(c: Context): void {
    const { file, checker } = c;
    const site = (node: ts.Node): string => `${relative(c.root, node.getSourceFile().fileName).replaceAll('\\', '/')}:${node.getStart()}:${node.getWidth()}`;
    const proof = (kind: FlowInteractionKind, node: ts.Node): string => {
        const id = c.addEvidence('semantic', node.getSourceFile(), node, `${kind}:${site(node)}`);
        c.evidence.get(id)!.flowKind = kind;
        return id;
    };
    const emit = (kind: FlowInteractionKind, from: string, to: string, node: ts.Node, endpoint?: { kind: FlowEndpointKind; identity: FlowEndpointIdentity; anchor: string }): void => {
        const discriminator = site(node);
        const id = flowFactId(kind, from, to, discriminator);
        const evidenceId = proof(kind, node);
        c.flowFacts.set(id, { id, kind, sourceId: from, targetId: to, discriminator, evidenceIds: [evidenceId] });
        if (endpoint) {
            const endpointId = flowEndpointId(endpoint.kind, endpoint.identity);
            const prior = c.flowEndpoints.get(endpointId);
            c.flowEndpoints.set(endpointId, { id: endpointId, kind: endpoint.kind, identity: endpoint.identity,
                anchorNodeId: prior?.anchorNodeId ?? endpoint.anchor, evidenceIds: [...new Set([...(prior?.evidenceIds ?? []), evidenceId])].sort() });
        }
    };
    const diagnostic = (code: string, node: ts.Node, scopeId: string | undefined): void => {
        const id = `flow:diagnostic:${encodeURIComponent(`${code}:${site(node)}`)}`;
        c.flowDiagnostics.set(id, { id, code, message: `${code} at ${site(node)}`, ...(scopeId ? { scopeId } : {}), evidenceIds: [c.addEvidence('semantic', node.getSourceFile(), node, id)] });
    };
    const literal = (node: ts.Expression | undefined, seen = new Set<ts.Symbol>()): string | undefined => {
        if (!node) return undefined;
        if (ts.isStringLiteralLike(node)) return node.text;
        if (ts.isTemplateExpression(node)) {
            let value = node.head.text;
            for (const part of node.templateSpans) {
                const resolved = literal(part.expression, seen);
                if (resolved === undefined) return undefined;
                value += resolved + part.literal.text;
            }
            return value;
        }
        if (ts.isIdentifier(node)) {
            const symbol = checker.getSymbolAtLocation(node);
            if (!symbol || seen.has(symbol)) return undefined;
            seen.add(symbol);
            const declaration = symbol.declarations?.find(ts.isVariableDeclaration);
            if (declaration?.parent && ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const)
                return literal(declaration.initializer, seen);
        }
        return undefined;
    };
    const enclosing = (node: ts.Node): string | undefined => {
        for (let parent = node.parent; parent && parent !== file; parent = parent.parent)
            if (ts.isFunctionLike(parent)) return c.callableId(parent);
        return undefined;
    };
    const packageMethod = (receiver: ts.Expression, name: string, fragment: string): boolean => {
        const declaration = checker.getTypeAtLocation(receiver).getProperty(name)?.declarations?.[0];
        return source(declaration).includes(fragment);
    };
    const handlerDeclaration = (value: ts.Expression): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined => {
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return value;
        if (!ts.isIdentifier(value)) return undefined;
        const symbol = checker.getSymbolAtLocation(value);
        const declaration = symbol && (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol).declarations?.[0];
        if (declaration && ts.isFunctionDeclaration(declaration)) return declaration;
        const initializer = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
        return initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) ? initializer : undefined;
    };
    const backedByPg = (receiver: ts.Expression, call: ts.Node): FlowEndpointIdentity | undefined => {
        const declaration = checker.getTypeAtLocation(receiver).getProperty('query')?.declarations?.[0];
        const origin = declaration?.getSourceFile();
        if (!origin || source(origin).includes('/node_modules/')) return undefined;
        // A local query contract is PostgreSQL-backed only when its defining module imports pg and delegates to its client.
        if (!/from\s*['"]pg['"]/.test(origin.text) || !/\.query\s*\(/.test(origin.text)) return undefined;
        // One evidenced pool in the contract module proves shared store identity, including transaction executors.
        return [...origin.text.matchAll(/\bnew\s+Pool\s*\(/g)].length === 1
            ? { connection: relative(c.root, origin.fileName).replaceAll('\\', '/') } : { sourceScope: site(call) };
    };
    const nodeHttp = (expression: ts.Expression, seen = new Set<ts.Symbol>()): boolean => {
        if (!ts.isIdentifier(expression)) return false;
        const symbol = checker.getSymbolAtLocation(expression);
        if (!symbol || seen.has(symbol)) return false;
        seen.add(symbol);
        for (const item of symbol.declarations ?? []) {
            if (ts.isImportSpecifier(item) && item.propertyName?.text === 'request' || ts.isImportSpecifier(item) && item.name.text === 'request') {
                const importNode = item.parent.parent.parent;
                if (ts.isImportDeclaration(importNode) && ts.isStringLiteral(importNode.moduleSpecifier) && /^node:https?$/.test(importNode.moduleSpecifier.text)) return true;
            }
            if (ts.isVariableDeclaration(item) && item.initializer) {
                const initializer = item.initializer;
                if (ts.isConditionalExpression(initializer) && nodeHttp(initializer.whenTrue, seen) && nodeHttp(initializer.whenFalse, seen)) return true;
                if (nodeHttp(initializer, seen)) return true;
            }
        }
        return false;
    };
    const calls = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const expression = node.expression;
            const member = ts.isPropertyAccessExpression(expression) ? expression : undefined;
            const caller = enclosing(node);
            if (member && methods.has(member.name.text) && packageMethod(member.expression, member.name.text, '/express-serve-static-core/')) {
                const route = literal(node.arguments[0]);
                const handler = node.arguments.slice(1).reverse().map(handlerDeclaration).find((item): item is ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression => !!item);
                const handlerId = handler && c.callableId(handler);
                if (!route || !handlerId) diagnostic('unresolved-express-route', node, caller);
                else {
                    const identity = { method: member.name.text.toUpperCase(), path: route };
                    const input = flowEndpointId('http-input', identity);
                    emit('receives', input, handlerId, node, { kind: 'http-input', identity, anchor: handlerId });
                    const responseParameter = handler.parameters[1];
                    const responseSymbol = responseParameter && checker.getSymbolAtLocation(responseParameter.name);
                    const root = (value: ts.Expression): ts.Expression => ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression)
                        ? root(value.expression.expression) : ts.isPropertyAccessExpression(value) ? root(value.expression) : value;
                    const output = (child: ts.Node): void => {
                        if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) &&
                            ['json', 'send', 'end'].includes(child.expression.name.text) && responseSymbol &&
                            ts.isIdentifier(root(child.expression.expression)) && checker.getSymbolAtLocation(root(child.expression.expression)) === responseSymbol) {
                            const endpoint = flowEndpointId('http-output', identity);
                            emit('responds', handlerId, endpoint, child, { kind: 'http-output', identity, anchor: handlerId });
                        }
                        ts.forEachChild(child, output);
                    };
                    if (handler.body) output(handler.body);
                }
            }
            if (caller && member?.name.text === 'query') {
                const identity = backedByPg(member.expression, node);
                if (identity) {
                    const sql = literal(node.arguments[0]);
                    const verb = /^\s*(?:--[^\n]*\n\s*)*(select|with|insert|update|delete)\b/i.exec(sql ?? '')?.[1].toLowerCase();
                    const kind = verb === 'select' ? 'reads' : ['insert', 'update', 'delete'].includes(verb ?? '') ? 'writes' : undefined;
                    if (!kind) diagnostic('unresolved-postgres-query', node, caller);
                    else {
                        emit(kind, caller, flowEndpointId('store', identity), node, { kind: 'store', identity, anchor: caller });
                        if (sql && !/\bjoin\b|\bfrom\s+[a-z_][\w]*\s*,/i.test(sql)) {
                            const table = (verb === 'select' ? /^\s*select\b[^()]*\bfrom\s+([a-z_][\w]*)\b/i : verb === 'insert' ? /\binsert\s+into\s+([a-z_][\w]*)\b/i :
                                verb === 'update' ? /\bupdate\s+([a-z_][\w]*)\b/i : /\bdelete\s+from\s+([a-z_][\w]*)\b/i).exec(sql)?.[1];
                            if (table) {
                                const id = flowFactId(kind, caller, flowEndpointId('store', identity), site(node));
                                const evidenceId = c.addEvidence('semantic', node.getSourceFile(), node.arguments[0], `${id}:table`);
                                c.evidence.get(evidenceId)!.flowEnrichmentKind = 'schema';
                                c.flowFacts.get(id)!.enrichment = [{ kind: 'schema', label: table, evidenceIds: [evidenceId] }];
                            }
                        }
                    }
                }
            }
            if (caller && (nodeHttp(expression) || member?.name.text === 'create' &&
                source(checker.getResolvedSignature(node)?.declaration).includes('/@google/genai/'))) {
                const google = member?.name.text === 'create' && source(checker.getResolvedSignature(node)?.declaration).includes('/@google/genai/');
                const first = node.arguments[0];
                const url = first && literal(first);
                let host: string | undefined;
                if (url) { try { host = new URL(url).host; } catch { /* dynamic or relative URL */ } }
                const identity: FlowEndpointIdentity = google ? { service: 'google-genai' } : host ? { protocol: new URL(url!).protocol.slice(0, -1), service: host } : { sourceScope: site(node) };
                emit('calls-external', caller, flowEndpointId('external-service', identity), node,
                    { kind: 'external-service', identity, anchor: caller });
            }
        }
        ts.forEachChild(node, calls);
    };
    calls(file);
}
