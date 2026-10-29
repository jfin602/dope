import type { Chat, ChatAssistantMessage } from '@dope/chat';
import type { StrategicDraftInput } from '@dope/project-intelligence/lib/node/roadmap-greenfield';

/** Parse only visible, completed saved text. Ambiguity is a review failure, never a reason to guess. */
export function extractSavedRoadmap(chat: Chat, source: ChatAssistantMessage, projectId: string,
    ownerRevision: number): StrategicDraftInput {
    if (source.execution.status !== 'complete' || !source.content.trim() ||
        /(?:\.\.\.|…|\bto be continued\b)\s*$/i.test(source.content.trim()))
        throw new Error('The saved planning answer is incomplete');
    const lines = source.content.split(/\r?\n/).slice(0, 500).map(line => line.trim());
    if (source.content.length > 64_000 || source.content.split(/\r?\n/).length > 500)
        throw new Error('The saved planning answer exceeds the extraction limit');
    const userText = chat.messages.filter(message => message.role === 'user').map(message => message.content).join('\n');
    const userDates = /\b(?:weeks?\s*\d|\d{4}-\d{2}-\d{2}|deadline)\b/i.test(userText);
    const clean = (value: string) => {
        let result = value.replace(/\*\*/g, '').replace(/[_`]/g, '').trim();
        if (!userDates) result = result.replace(/\s*[\[(](?:weeks?\s*\d+(?:\s*[-–—]\s*\d+)?|\d{4}-\d{2}-\d{2})[\])]/gi, '');
        return result.trim().slice(0, 180);
    };
    const usable = (line: string) => !!line && !/^(?:>|\|)/.test(line) && !/^```/.test(line);
    const phases: StrategicDraftInput['phases'] = [];
    let fenced = false;
    let phaseMode = false;
    for (const line of lines) {
        if (/^```/.test(line)) { fenced = !fenced; continue; }
        if (fenced || !usable(line)) continue;
        const match = line.match(/^(?:#{1,6}\s*)?(?:\*\*)?Phase\s+(\d{1,2})\s*[:.\-–—]?\s*(.+?)(?:\*\*)?\s*$/i);
        if (match) {
            phaseMode = true;
            if (Number(match[1]) !== phases.length + 1) throw new Error('Phase numbers are missing or competing');
            const title = clean(match[2]);
            if (!title) throw new Error('A phase has no title');
            phases.push({ title, objective: '', checkpoints: [] });
        } else if (phaseMode && phases.length && /^(?:[-*•]\s+)(.+)$/.test(line)) {
            const title = clean(line.replace(/^[-*•]\s+/, ''));
            if (title && phases.at(-1)!.checkpoints.length < 16)
                phases.at(-1)!.checkpoints.push({ title, objective: '', dependsOn: [] });
        }
    }
    if (!phaseMode) {
        const labels = lines.flatMap((line, index) =>
            /^(?:#{1,6}\s*)?(?:implementation order(?: recommendation)?|roadmap|implementation roadmap)\s*:?$/i.test(line.replace(/\*\*/g, ''))
                ? [index] : []);
        const sequences: StrategicDraftInput['phases'][] = [];
        const starts = labels.length ? labels : [0];
        for (const start of starts) {
            const found: StrategicDraftInput['phases'] = [];
            let fenced = false;
            for (let index = start + (labels.length ? 1 : 0); index < lines.length; index++) {
                const line = lines[index];
                if (/^```/.test(line)) { fenced = !fenced; continue; }
                if (fenced || !usable(line)) continue;
                if (labels.length && index > start + 1 && /^(?:#{1,6}\s*)?[A-Z][^.!?]{2,80}:?$/.test(line) &&
                    !/^\d+[.)]\s/.test(line)) break;
                const match = line.match(/^(\d{1,2})[.)]\s+(.+)$/);
                if (!match) continue;
                if (Number(match[1]) !== found.length + 1) { found.length = 0; break; }
                const title = clean(match[2]);
                if (!title) { found.length = 0; break; }
                found.push({ title, objective: '', checkpoints: [] });
            }
            if (found.length >= 2) sequences.push(found);
        }
        if (sequences.length !== 1) throw new Error('No unique ordered implementation sequence in the saved answer');
        phases.push(...sequences[0]);
    }
    if (phases.length < 2 || phases.length > 32) throw new Error('Saved answer needs 2–32 ordered phases');
    return { projectId, ownerRevision, allowIncomplete: true, phases };
}

export function roadmapCreationIntent(text: string): 'create' | 'ambiguous' | undefined {
    const value = text.trim();
    if (/[\n\r"'`]/.test(value) && !/^let['’]?s\s/i.test(value)) return undefined;
    if (/^roadmap[.!?]?$/i.test(value)) return 'ambiguous';
    return /^(?:(?:let['’]?s|please|can we|i want to|we should)\s+)?(?:make|create|start|build|generate)\s+(?:(?:a|the|our|my)\s+)?roadmap(?:\s+(?:first|draft|now))?[.!?]?$/i.test(value) ||
        /^let['’]?s\s+(?:make|create)\s+(?:(?:a|the|our)\s+)?roadmap(?:\s+first)?[.!?]?$/i.test(value)
        ? 'create' : undefined;
}
