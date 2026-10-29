import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

export const source = '# Roadmap\r\nIntro stays.\r\n## Phase 1 [id: phase-one]: First\r\nObjective: Deliver first\r\n### Gate G1 [id: gate-one] [phase: phase-one]: Check first\r\nObjective: Prove first\r\n- Criterion C1 [id: criterion-one]: Result one — Expected: one is visible\r\nUnmapped prose stays.\r\n- [ ] Build task, not a Gate\r\n';
export const sha = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');
export async function gateFixture(run: (root: string, file: string, store: RoadmapStore) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-linked-'));
    const file = join(root, 'ROADMAP.md');
    try {
        await writeFile(file, source);
        const store = new RoadmapStore();
        const preview = await previewRoadmapImport(root, 'ROADMAP.md');
        await store.acceptGateImport(root, 0, 'owner-one', preview);
        await run(root, file, store);
    } finally { await rm(root, { recursive: true, force: true }); }
}
export async function sourceBytes(file: string): Promise<Buffer> { return readFile(file); }
