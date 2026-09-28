import type { PlanningFileLink } from '@dope/contracts/lib/planning';

export async function openPlanningFile(link: PlanningFileLink, exists: () => Promise<boolean>,
    openEditor: (line?: number) => Promise<unknown>, current: () => boolean): Promise<boolean> {
    if (!current() || !await exists() || !current()) return false;
    await openEditor(link.line);
    return true;
}
