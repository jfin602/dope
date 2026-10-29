/** Conservative, sentence-bound checks for the six owner-stated game requirements. */
type Requirement = { label: string; matches: (text: string) => boolean; subject: RegExp };

function units(text: string): string[] {
    return text.replace(/pixi\s*\.\s*js/gi, 'pixijs')
        .split(/(?:[.!?](?=\s|$)|[;\n\r]|\s+\bbut\b\s+)/i)
        .map(unit => unit.trim().toLowerCase()).filter(Boolean);
}
const anyUnit = (text: string, match: (unit: string) => boolean): boolean => units(text).some(match);
const has = (unit: string, pattern: RegExp): boolean => pattern.test(unit);
const tower = /\b(?:main|home|player|your|my)\s+tower\b|\bbase\b/i;
const health = /\b(?:health|hp|hit\s*points?)\b/i;
const zero = /\b(?:0|zero|no)\b/i;
const loss = /\b(?:lose|loses|loss|lost|defeat(?:ed)?|game\s+(?:is\s+)?over|game\s+ends?|player\s+dies?)\b/i;
const negateLoss = /\b(?:do\s+not|don't|does\s+not|doesn't|won't|will\s+not|never)\s+(?:\w+\s+){0,3}(?:lose|end|die|trigger\s+defeat)\b/i;
const resetHealth = /\b(?:reset|restore|refill|refresh|regenerat)\w*\b.{0,35}\b(?:health|hp)\b|\b(?:health|hp)\b.{0,35}\b(?:reset|restore|refill|refresh|regenerat)\w*\b/i;
const hedge = /\b(?:maybe|might|perhaps|consider|could|should|unsure)\b/i;

const requirements: Requirement[] = [
    { label: 'PixiJS 2D', subject: /\bpixijs\b/i, matches: text => anyUnit(text, unit =>
        has(unit, /\bpixijs\b/i) && has(unit, /\b(?:2d|two.dimension(?:al)?)\b/i)) },
    { label: 'fixed enemy path', subject: /\b(?:enemy|enemies)\b.{0,40}\b(?:path|route)\b/i, matches: text => anyUnit(text, unit =>
        has(unit, /\b(?:enemy|enemies)\b/i) && has(unit, /\b(?:path|route)\b/i) &&
        has(unit, /\b(?:fixed|predefined|predetermined|set|same|unchanging)\b/i)) },
    { label: 'kill income', subject: /\b(?:kill|defeat)\w*\b.{0,45}\b(?:money|currency|coins?|cash|gold)\b/i,
        matches: text => anyUnit(text, unit =>
        has(unit, /\b(?:kill|kills|killing|defeat|defeating|destroy)\w*\b.{0,55}\b(?:earn|gain|collect|reward|receive|get|drop)\w*\b.{0,30}\b(?:money|currency|coins?|cash|gold)\b/i) ||
        has(unit, /\b(?:earn|gain|collect|reward|receive|get)\w*\b.{0,30}\b(?:money|currency|coins?|cash|gold)\b.{0,55}\b(?:kill|kills|killing|defeat|defeating|destroy)\w*\b/i) ||
        has(unit, /\b(?:money|currency|coins?|cash|gold)\b.{0,45}\b(?:from|for|per|on)\b.{0,20}\b(?:kill|kills|killing|defeat|defeating|destroy)\w*\b/i)) },
    { label: 'persistent main tower health', subject: tower, matches: text => anyUnit(text, unit =>
        has(unit, tower) && has(unit, health) && !has(unit, resetHealth) &&
        (has(unit, /\b(?:persist|persistent|carry|carries|retains?|keep|keeps|remain|stays)\w*\b.{0,55}\b(?:waves?|rounds?)\b/i) ||
         has(unit, /\b(?:waves?|rounds?)\b.{0,55}\b(?:persist|persistent|carry|carries|retains?|keep|keeps|remain|stays)\w*\b/i) ||
         has(unit, /\b(?:persist|persistent)\b.{0,55}\b(?:health|hp)\b|\b(?:health|hp)\b.{0,55}\b(?:persist|persistent)\b/i))) },
    { label: 'zero health means loss', subject: tower, matches: text => anyUnit(text, unit => {
        if (!has(unit, tower) || has(unit, negateLoss)) return false;
        if (has(unit, /\b(?:base|(?:main|home|player|your|my)\s+tower)\b.{0,35}\b(?:destroyed|dies|falls)\b/i) &&
            has(unit, loss)) return true;
        if (!has(unit, health) || !has(unit, zero) || !has(unit, loss)) return false;
        const target = unit.match(tower);
        const hp = unit.match(health);
        const zeroMatch = unit.match(zero);
        if (!target || !hp || !zeroMatch || target.index === undefined || hp.index === undefined ||
            zeroMatch.index === undefined) return false;
        // The health belongs to the player tower/base, not an enemy elsewhere in the sentence.
        return Math.abs(target.index - hp.index) <= 45 && Math.abs(hp.index - zeroMatch.index) <= 45 &&
            !has(unit.slice(Math.min(target.index, hp.index), Math.max(target.index, hp.index)), /\benemy\b/i);
    }) },
    { label: 'currency buys towers and abilities', subject: /\b(?:buy|purchase|spend)\w*\b.{0,50}\btowers?\b/i,
        matches: text => anyUnit(text, unit =>
        has(unit, /\b(?:money|currency|coins?|cash|gold|resources?)\b/i) &&
        has(unit, /\b(?:buy|buys|buying|purchase|purchasing|spend|spending)\b/i) &&
        has(unit, /\btowers?\b/i) && has(unit, /\babilit(?:y|ies)\b/i) &&
        !has(unit, /\babilit(?:y|ies)\b.{0,25}\b(?:free|without\s+cost)\b/i)) },
];

export function roadmapRequirementCoverage(requestedMessages: readonly string[],
    proposedPhases: readonly string[]): string[] {
    // Keep both message and phase boundaries: unrelated statements cannot establish a relationship.
    const requested = (requirement: Requirement) => requestedMessages.some(message => requirement.matches(message));
    const covered = (requirement: Requirement) => proposedPhases.some(phase => requirement.matches(phase));
    const ambiguous = (requirement: Requirement) => requestedMessages.some(message => anyUnit(message,
        unit => has(unit, hedge) && has(unit, requirement.subject)));
    return requirements.map(requirement => `${requirement.label}: ${requested(requirement) ?
        covered(requirement) ? 'Covered' : 'Uncovered' : ambiguous(requirement) ?
            'Ambiguous in saved request — confirm with developer' : 'Not in saved request'}`);
}
