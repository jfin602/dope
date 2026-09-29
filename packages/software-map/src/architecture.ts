import type { ArchitectureDeclaration, ComponentDeclaration, DeclaredBoundary, SubsystemDeclaration, SystemDeclaration, Ownership } from './contracts';

function fail(message: string): never { throw new Error(`Invalid architecture declaration: ${message}`); }
function object(value: unknown, at: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(at);
    return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, required: string[], optional: string[], at: string): void {
    if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail(at);
}
function nonempty(value: unknown, at: string): string {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) fail(at);
    return value;
}
export function projectPath(value: unknown): string {
    const path = nonempty(value, 'path');
    if (path.includes('\\') || path.includes('\0') || path.includes(':') || path.startsWith('/') ||
        path.split('/').some(part => !part || part === '.' || part === '..')) fail(`unsafe path ${path}`);
    return path;
}
function stringList(value: unknown, at: string): string[] {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) fail(at);
    const items = value.map(item => nonempty(item, at));
    if (new Set(items).size !== items.length) fail(`duplicate ${at}`);
    return items.sort();
}
function roots(value: unknown, at: string, required: boolean): string[] | undefined {
    if (value === undefined && !required) return undefined;
    const list = stringList(value, `${at}.roots`).map(projectPath);
    if (!list.length) fail(`${at}.roots`);
    return list;
}
function boundary(value: Record<string, unknown>, at: string, requiredRoots: boolean): DeclaredBoundary {
    const id = nonempty(value.id, `${at}.id`);
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(id)) fail(`${at}.id`);
    return {
        id,
        name: nonempty(value.name, `${at}.name`),
        purpose: nonempty(value.purpose, `${at}.purpose`),
        ...((value.roots !== undefined || requiredRoots) ? { roots: roots(value.roots, at, requiredRoots) } : {}),
    };
}
function array(value: unknown, at: string, required: boolean): unknown[] {
    if (!Array.isArray(value) || (required && !value.length)) fail(at);
    return value;
}

/** Strict, versioned parser for developer-authored .dope/architecture.json data. */
export function parseArchitecture(input: unknown): ArchitectureDeclaration {
    const data = object(input, 'root');
    fields(data, ['schemaVersion', 'systems'], [], 'root fields');
    if (data.schemaVersion !== 1) fail('unsupported schemaVersion');
    const seenIds = new Set<string>();
    const seenRoots = new Map<string, string>();
    const subsystems = new Map<string, SubsystemDeclaration>();
    function register(item: DeclaredBoundary): void {
        if (seenIds.has(item.id)) fail(`duplicate id ${item.id}`);
        seenIds.add(item.id);
        for (const root of item.roots ?? []) {
            if (seenRoots.has(root)) fail(`ambiguous ownership root ${root}`);
            seenRoots.set(root, item.id);
        }
    }
    const systems: SystemDeclaration[] = array(data.systems, 'systems', true).map((rawSystem, i) => {
        const at = `systems[${i}]`;
        const value = object(rawSystem, at);
        fields(value, ['id', 'name', 'purpose', 'subsystems'], ['roots'], at);
        const system = boundary(value, at, false);
        register(system);
        const children: SubsystemDeclaration[] = array(value.subsystems, `${at}.subsystems`, true).map((rawSubsystem, j) => {
            const childAt = `${at}.subsystems[${j}]`;
            const child = object(rawSubsystem, childAt);
            fields(child, ['id', 'name', 'purpose', 'roots'], ['components', 'allowedDependencies', 'forbiddenDependencies'], childAt);
            const subsystem = boundary(child, childAt, true) as SubsystemDeclaration;
            register(subsystem);
            if (child.allowedDependencies !== undefined) subsystem.allowedDependencies = stringList(child.allowedDependencies, `${childAt}.allowedDependencies`);
            if (child.forbiddenDependencies !== undefined) subsystem.forbiddenDependencies = stringList(child.forbiddenDependencies, `${childAt}.forbiddenDependencies`);
            if (child.components !== undefined) subsystem.components = array(child.components, `${childAt}.components`, false).map((rawComponent, k) => {
                const componentAt = `${childAt}.components[${k}]`;
                const component = object(rawComponent, componentAt);
                fields(component, ['id', 'name', 'purpose', 'roots'], [], componentAt);
                const result = boundary(component, componentAt, true) as ComponentDeclaration;
                register(result);
                return result;
            }).sort((a, b) => a.id.localeCompare(b.id));
            subsystems.set(subsystem.id, subsystem);
            return subsystem;
        }).sort((a, b) => a.id.localeCompare(b.id));
        return { ...system, subsystems: children };
    }).sort((a, b) => a.id.localeCompare(b.id));
    for (const subsystem of subsystems.values()) {
        for (const target of [...(subsystem.allowedDependencies ?? []), ...(subsystem.forbiddenDependencies ?? [])]) {
            if (!subsystems.has(target)) fail(`unknown dependency target ${target}`);
        }
        if (subsystem.allowedDependencies?.some(target => subsystem.forbiddenDependencies?.includes(target))) fail(`conflicting dependency target ${subsystem.id}`);
    }
    return { schemaVersion: 1, systems };
}

export function parseArchitectureJson(json: string): ArchitectureDeclaration {
    let value: unknown;
    try { value = JSON.parse(json); } catch { fail('malformed JSON'); }
    return parseArchitecture(value);
}

/** Longest explicit path-prefix selector wins. Parser rejects equal roots across owners. */
export function ownershipForPath(architecture: ArchitectureDeclaration, inputPath: string): Ownership {
    const path = projectPath(inputPath);
    const candidates: Array<Ownership & { matchedRoot: string }> = [];
    const match = (root: string): boolean => path === root || path.startsWith(`${root}/`);
    for (const system of architecture.systems) {
        for (const root of system.roots ?? []) if (match(root)) candidates.push({ state: 'assigned', systemId: system.id, matchedRoot: root });
        for (const subsystem of system.subsystems) {
            for (const root of subsystem.roots) if (match(root)) candidates.push({ state: 'assigned', systemId: system.id, subsystemId: subsystem.id, matchedRoot: root });
            for (const component of subsystem.components ?? []) {
                for (const root of component.roots) if (match(root)) candidates.push({ state: 'assigned', systemId: system.id, subsystemId: subsystem.id, componentId: component.id, matchedRoot: root });
            }
        }
    }
    candidates.sort((a, b) => b.matchedRoot.length - a.matchedRoot.length || a.matchedRoot.localeCompare(b.matchedRoot));
    if (candidates.length > 1 && candidates[0].matchedRoot.length === candidates[1].matchedRoot.length) fail(`ambiguous ownership for ${path}`);
    return candidates[0] ?? { state: 'unassigned' };
}
