/** Read-only correction membership. A dependency remains a dependency, not a generated parent edge. */
export interface PhaseAssociation {
    phaseId?: string;
    source?: 'explicit' | 'identifier';
    unresolvedReason?: string;
}

export const correctionPhaseNumber = (value: string): number | undefined => {
    const match = /^c(0|[1-9]\d*)(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/.exec(value);
    return match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : undefined;
};

export const roadmapPhaseNumber = (title: string): number | undefined => {
    const match = /^(?:Product )?Phase (\d+)\b/i.exec(title) ?? /^Foundation Spike (0)\b/i.exec(title);
    return match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : undefined;
};

/** Heading codes, stable section keys, and task folders count; incidental prose does not. */
export function correctionIdentifier(id: string, title: string, sourcePaths: readonly string[] = []): number | undefined {
    const section = id.includes('#') ? id.slice(id.lastIndexOf('#') + 1) : id;
    const candidates = [section, ...[...title.matchAll(/`(c\d+(?:-[a-z0-9]+)*)`/g)].map(match => match[1]),
        ...sourcePaths.map(path => /^docs\/tasks\/(c\d+(?:-[a-z0-9]+)*)\//.exec(path)?.[1] ?? '')];
    const numbers = [...new Set(candidates.map(correctionPhaseNumber).filter((n): n is number => n !== undefined))];
    return numbers.length === 1 ? numbers[0] : undefined;
}

export function resolveCorrectionPhase(identifierPhase: number | undefined, explicitPhaseIds: readonly string[],
    phases: ReadonlyMap<number, readonly string[]>): PhaseAssociation {
    const explicit = [...new Set(explicitPhaseIds)];
    if (explicit.length > 1) return { unresolvedReason: 'Conflicting explicit phase associations.' };
    const explicitId = explicit[0];
    if (explicitId) {
        const explicitNumber = [...phases].find(([, ids]) => ids.includes(explicitId))?.[0];
        if (explicitNumber === undefined) return { unresolvedReason: 'Explicit phase association is absent.' };
        if (identifierPhase !== undefined && identifierPhase !== explicitNumber)
            return { unresolvedReason: `Explicit phase ${explicitNumber} conflicts with correction identifier c${identifierPhase}.` };
        return { phaseId: explicitId, source: 'explicit' };
    }
    if (identifierPhase === undefined) return { unresolvedReason: 'No reliable correction phase identifier.' };
    const candidates = phases.get(identifierPhase) ?? [];
    if (candidates.length !== 1) return { unresolvedReason: candidates.length ?
        `Ambiguous Phase ${identifierPhase} association.` : `Phase ${identifierPhase} is absent.` };
    return { phaseId: candidates[0], source: 'identifier' };
}
