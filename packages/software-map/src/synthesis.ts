import { projectPath } from './architecture';

/** Rebuildable deterministic facts. IDs are packet-local; source IDs link to physical evidence. */
interface PacketItem { id: string; path: string; sourceEvidenceIds: string[] }
/** Repository-authored context. Never an implementation evidence reference. */
export interface DocumentSupport {
    path: string;
    class: 'modules-seed' | 'readme-orientation' | 'architecture' | 'decision' | 'contract' |
        'package-readme' | 'operations' | 'api-config' | 'developer-guidance' | 'planning';
    authority: 'Documented';
    status: 'accepted' | 'unknown';
    sha256: string;
    bytes: number;
    truncated: boolean;
    content: string;
}
export type ArchitectureEvidenceItem =
    | (PacketItem & { kind: 'topology'; scope: 'workspace' | 'package'; name: string; workspaces?: string[]; version?: string })
    | (PacketItem & { kind: 'configuration'; signal: string; sourcePaths?: string[] })
    | (PacketItem & { kind: 'entrypoint'; role: string })
    | (PacketItem & { kind: 'dependency'; targetPath: string; relation: string; relationshipIds: string[] })
    | (PacketItem & { kind: 'semantic'; symbol: string; relation: string })
    | (PacketItem & { kind: 'framework'; framework: string; producer: string; producerVersion: string; concept: string; name: string;
        target?: string; role?: string; servicePath?: string; widgetArea?: string });
export interface ArchitectureEvidencePacket {
    schemaVersion: 1;
    /** Hash of implementation inputs only; excludes canonical architecture declarations. */
    sourceFingerprint?: string;
    inputFingerprint: string;
    items: ArchitectureEvidenceItem[];
    documents?: DocumentSupport[];
}

/** Test and generated source can inform a boundary, but cannot alone establish a production System. */
export const isProductionEvidencePath = (path: string): boolean =>
    !/(^|\/)(test|tests|fixtures|examples?|docs|documentation|generated|__tests__|__fixtures__|dist|build|coverage)(\/|$)|(?:\.test|\.spec)\.[^/]+$/.test(path) &&
    !path.startsWith('.dope/');

/** Context facts describe deployment; direct facts describe source-backed production behavior. */
export const isDirectSystemResponsibilityEvidence = (item: ArchitectureEvidenceItem): boolean =>
    isProductionEvidencePath(item.path) && item.sourceEvidenceIds.length > 0 &&
    !/(^|\/)(package\.json|[^/]+\.config\.[^/]+)$/.test(item.path) &&
    (item.kind === 'semantic' || item.kind === 'framework' && /(?:^|-)(?:handler|route|job)(?:$|-)/.test(item.concept) ||
        item.kind === 'entrypoint');

/** This lifecycle is distinct from Physical Map indexing status and declaration-file presence. */
export type SoftwareMapInitializationState = 'uninitialized' | 'analyzing' | 'review_required' | 'initialized';
export type ProposedArchitectureKind = 'system' | 'subsystem' | 'component';
export type ArchitectureEvidenceRequestKind = ArchitectureEvidenceItem['kind'];
export interface ArchitectureEvidenceRequest {
    kind: ArchitectureEvidenceRequestKind;
    targets: string[];
    reason: string;
}
export interface ProposedArchitectureNode {
    /** Ephemeral proposal-local key, never a canonical architecture ID. */
    proposalKey: string;
    kind: ProposedArchitectureKind;
    name: string;
    purpose: string;
    parentProposalKey: string | null;
    /** Synthesis confidence signal, not probability or authority. */
    confidence: number;
    rationale: string;
    evidenceRefs: string[];
    /** Human-readable explanation; never a substitute for evidenceRefs. */
    evidence: string[];
}
export interface ArchitectureProposal {
    schemaVersion: 1;
    summary: string;
    needsMoreEvidence: boolean;
    nodes: ProposedArchitectureNode[];
    unassignedEvidenceRefs: string[];
    openQuestions: string[];
    evidenceRequests: ArchitectureEvidenceRequest[];
}

const nonempty = { type: 'string', minLength: 1 } as const;
// Canonical declaration IDs cannot contain ':', so these keys cannot be persisted as-is.
const proposalKey = { type: 'string', pattern: '^proposal:[A-Za-z0-9._-]+$' } as const;
const refList = { type: 'array', items: nonempty, uniqueItems: true } as const;
const explanationList = { type: 'array', items: nonempty } as const;
const evidenceKinds = ['topology', 'configuration', 'entrypoint', 'dependency', 'semantic', 'framework'] as const;
export const architectureProposalSchema = {
    type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'summary', 'needsMoreEvidence', 'nodes', 'unassignedEvidenceRefs', 'openQuestions', 'evidenceRequests'],
    properties: {
        schemaVersion: { const: 1 }, summary: nonempty, needsMoreEvidence: { type: 'boolean' },
        nodes: { type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['proposalKey', 'kind', 'name', 'purpose', 'parentProposalKey', 'confidence', 'rationale', 'evidenceRefs', 'evidence'],
            properties: {
                proposalKey, kind: { enum: ['system', 'subsystem', 'component'] }, name: nonempty, purpose: nonempty,
                parentProposalKey: { anyOf: [proposalKey, { type: 'null' }] }, confidence: { type: 'number', minimum: 0, maximum: 1 },
                rationale: nonempty, evidenceRefs: { ...refList, minItems: 1 }, evidence: explanationList,
            },
        } },
        unassignedEvidenceRefs: refList, openQuestions: explanationList,
        evidenceRequests: { type: 'array', maxItems: 5, items: {
            type: 'object', additionalProperties: false, required: ['kind', 'targets', 'reason'],
            properties: {
                kind: { enum: evidenceKinds },
                targets: { ...refList, minItems: 1, maxItems: 5 }, reason: nonempty,
            },
        } },
    },
} as const;

function fail(at: string): never { throw new Error(`Invalid architecture proposal: ${at}`); }
function object(value: unknown, at: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(at);
    return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, names: readonly string[], at: string): void {
    if (Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) fail(`${at} fields`);
}
function string(value: unknown, at: string): string {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) fail(at);
    return value;
}
function list(value: unknown, at: string, min = 0, max = Infinity): string[] {
    if (!Array.isArray(value) || value.length < min || value.length > max) fail(at);
    return value.map((item, i) => string(item, `${at}[${i}]`));
}
function unique(values: string[], at: string): void {
    if (new Set(values).size !== values.length) fail(`duplicate ${at}`);
}

/** Validate the trusted analyzer's packet before accepting any model references into it. */
export function validateArchitectureEvidencePacket(packet: ArchitectureEvidencePacket): void {
    if (!packet || packet.schemaVersion !== 1 || !Array.isArray(packet.items)) fail('packet');
    string(packet.inputFingerprint, 'packet fingerprint');
    if (packet.sourceFingerprint !== undefined) string(packet.sourceFingerprint, 'packet source fingerprint');
    const ids: string[] = [];
    for (const item of packet.items) {
        if (!item || !evidenceKinds.includes(item.kind)) fail('packet item kind');
        ids.push(string(item.id, 'packet item id'));
        try { projectPath(item.path); } catch { fail('packet item path'); }
        unique(list(item.sourceEvidenceIds, 'source evidence IDs'), 'source evidence IDs');
        switch (item.kind) {
            case 'topology':
                if (item.scope !== 'workspace' && item.scope !== 'package') fail('topology scope');
                string(item.name, 'topology name');
                if (item.version !== undefined) string(item.version, 'topology version');
                if (item.workspaces !== undefined) unique(list(item.workspaces.map(projectPath), 'workspace paths'), 'workspace paths');
                break;
            case 'configuration':
                string(item.signal, 'configuration signal');
                if (item.sourcePaths !== undefined) unique(list(item.sourcePaths.map(projectPath), 'source paths'), 'source paths');
                break;
            case 'entrypoint': string(item.role, 'entrypoint role'); break;
            case 'dependency':
                try { projectPath(item.targetPath); } catch { fail('dependency target'); }
                string(item.relation, 'dependency relation');
                unique(list(item.relationshipIds, 'relationship IDs', 1), 'relationship IDs'); break;
            case 'semantic': string(item.symbol, 'semantic symbol'); string(item.relation, 'semantic relation'); break;
            case 'framework':
                for (const [name, value] of Object.entries({ framework: item.framework, producer: item.producer,
                    producerVersion: item.producerVersion, concept: item.concept, name: item.name })) string(value, `framework ${name}`);
                for (const value of [item.target, item.role, item.servicePath, item.widgetArea]) if (value !== undefined) string(value, 'framework metadata');
                if (!item.sourceEvidenceIds.length && item.concept !== 'manifest-extension') fail('framework source evidence');
                break;
        }
    }
    unique(ids, 'packet item ID');
    if (packet.documents !== undefined) {
        if (!Array.isArray(packet.documents)) fail('packet documents');
        const paths: string[] = [];
        for (const doc of packet.documents) {
            try { projectPath(doc.path); } catch { fail('document path'); }
            paths.push(doc.path);
            if (doc.authority !== 'Documented' || !['accepted', 'unknown'].includes(doc.status) ||
                !['modules-seed', 'readme-orientation', 'architecture', 'decision', 'contract', 'package-readme',
                    'operations', 'api-config', 'developer-guidance', 'planning'].includes(doc.class) ||
                !/^[a-f0-9]{64}$/.test(doc.sha256) || !Number.isSafeInteger(doc.bytes) || doc.bytes < 0 ||
                typeof doc.truncated !== 'boolean' || typeof doc.content !== 'string' || doc.content.length > 20000) fail('document metadata');
        }
        unique(paths, 'document paths');
    }
}

/** Strict structured-output validation plus packet-local provenance and hierarchy checks. */
export function parseArchitectureProposal(input: unknown, packet: ArchitectureEvidencePacket): ArchitectureProposal {
    validateArchitectureEvidencePacket(packet);
    const data = object(input, 'root');
    fields(data, architectureProposalSchema.required, 'root');
    if (data.schemaVersion !== 1) fail('unsupported schemaVersion');
    string(data.summary, 'summary');
    if (typeof data.needsMoreEvidence !== 'boolean' || !Array.isArray(data.nodes) || !Array.isArray(data.evidenceRequests)) fail('root values');
    const packetIds = new Set(packet.items.map(item => item.id));
    const refs = (value: unknown, at: string, min = 0): string[] => {
        const ids = list(value, at, min);
        unique(ids, at);
        if (ids.some(id => !packetIds.has(id))) fail(`unknown ${at}`);
        return ids;
    };
    const nodes = data.nodes.map((raw, i) => {
        const at = `nodes[${i}]`;
        const node = object(raw, at);
        fields(node, architectureProposalSchema.properties.nodes.items.required, at);
        if (!/^proposal:[A-Za-z0-9._-]+$/.test(string(node.proposalKey, `${at}.proposalKey`))) fail(`${at}.proposalKey`);
        if (node.kind !== 'system' && node.kind !== 'subsystem' && node.kind !== 'component') fail(`${at}.kind`);
        string(node.name, `${at}.name`);
        string(node.purpose, `${at}.purpose`);
        if (node.parentProposalKey !== null && !/^proposal:[A-Za-z0-9._-]+$/.test(string(node.parentProposalKey, `${at}.parentProposalKey`))) fail(`${at}.parentProposalKey`);
        if (typeof node.confidence !== 'number' || !Number.isFinite(node.confidence) || node.confidence < 0 || node.confidence > 1) fail(`${at}.confidence`);
        string(node.rationale, `${at}.rationale`);
        refs(node.evidenceRefs, `${at}.evidenceRefs`, 1);
        list(node.evidence, `${at}.evidence`);
        return node as unknown as ProposedArchitectureNode;
    });
    unique(nodes.map(node => node.proposalKey), 'proposalKey');
    const byKey = new Map(nodes.map(node => [node.proposalKey, node]));
    for (const node of nodes) {
        const expected = node.kind === 'subsystem' ? 'system' : 'subsystem';
        if (node.kind === 'system') {
            if (node.parentProposalKey !== null) fail(`system parent ${node.proposalKey}`);
        } else if (node.parentProposalKey === null || byKey.get(node.parentProposalKey)?.kind !== expected) {
            fail(`invalid parent ${node.proposalKey}`);
        }
    }
    refs(data.unassignedEvidenceRefs, 'unassignedEvidenceRefs');
    list(data.openQuestions, 'openQuestions');
    if (data.evidenceRequests.length > 5) fail('evidenceRequests');
    for (const [i, raw] of data.evidenceRequests.entries()) {
        const at = `evidenceRequests[${i}]`;
        const request = object(raw, at);
        fields(request, architectureProposalSchema.properties.evidenceRequests.items.required, at);
        if (!evidenceKinds.includes(request.kind as ArchitectureEvidenceRequestKind)) fail(`${at}.kind`);
        const targets = list(request.targets, `${at}.targets`, 1, 5);
        unique(targets, `${at}.targets`);
        for (const target of targets) try { projectPath(target); } catch { fail(`${at}.targets`); }
        string(request.reason, `${at}.reason`);
    }
    if (data.needsMoreEvidence !== (data.evidenceRequests.length > 0)) fail('evidence request state');
    return data as unknown as ArchitectureProposal;
}

export function parseArchitectureProposalJson(json: string, packet: ArchitectureEvidencePacket): ArchitectureProposal {
    let value: unknown;
    try { value = JSON.parse(json); } catch { fail('malformed JSON'); }
    return parseArchitectureProposal(value, packet);
}
