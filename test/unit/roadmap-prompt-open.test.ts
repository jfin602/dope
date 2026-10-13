import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveRoadmapPromptSource } from '../../packages/theia-extension/src/node/roadmap-prompt-open.ts';
import { RoadmapInspectorModel } from '../../packages/theia-extension/src/browser/roadmap-inspector-model.ts';
import type { RoadmapService } from '../../packages/theia-extension/src/roadmap-service.ts';
import type { CheckpointNode } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import type { RoadmapIndex } from '../../packages/project-intelligence/src/node/roadmap-store.ts';

const source = resolve(import.meta.dirname, '../../docs/tasks/c10-roadmap-create-sync');
const relative = 'docs/tasks/c10-roadmap-create-sync/P16-prompt-source-navigation.txt';
const fingerprint = createHash('sha256').update(readFileSync(join(source, 'P16-prompt-source-navigation.txt'))).digest('hex');

test('prompt resolver opens only the exact current in-root source; stale, moved, foreign and symlink paths fail', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dope-prompt-open-'));
    const folder = join(root, 'docs/tasks/c10-roadmap-create-sync');
    const discover = async () => [{ path: 'docs/tasks/c10-roadmap-create-sync', prompts: [
        { path: relative, fingerprint }], executable: false as const }] as Awaited<ReturnType<typeof import('../../packages/agent-core/src/node/roadmap-task-discovery.ts').discoverRoadmapTaskStacks>>;
    const validate = () => resolveRoadmapPromptSource(root, relative, fingerprint, discover);
    try {
        mkdirSync(folder, { recursive: true });
        cpSync(join(source, 'P16-prompt-source-navigation.txt'), join(root, relative));
        assert.equal(await validate(), pathToFileURL(join(root, relative)).toString());
        await assert.rejects(resolveRoadmapPromptSource(root, '../outside.txt', fingerprint, discover), /Refresh.*relink/);
        await assert.rejects(resolveRoadmapPromptSource(root, relative, '0'.repeat(64), discover), /Refresh.*relink/);
        const file = join(root, relative);
        writeFileSync(file, 'changed');
        await assert.rejects(validate(), /Refresh.*relink/);
        rmSync(file);
        cpSync(join(source, 'P16-prompt-source-navigation.txt'), file);
        renameSync(file, `${file}.moved`);
        await assert.rejects(validate(), /Refresh.*relink/);
        symlinkSync(`${file}.moved`, file);
        await assert.rejects(validate(), /Refresh.*relink/);
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test('inspector prompt selection and Open Prompt use validated URI without starting work', async () => {
    const opened: string[] = [];
    let resolved = 0;
    const service = { resolvePromptSource: async (_uri: string, path: string, hash: string) => {
        resolved++;
        assert.equal(path, relative);
        assert.equal(hash, fingerprint);
        return 'file:///project/docs/tasks/c10-roadmap-create-sync/P16-prompt-source-navigation.txt';
    }, apply: () => { throw new Error('Work must not start'); } } as unknown as RoadmapService;
    const model = new RoadmapInspectorModel(service, async uri => { opened.push(uri); });
    const index = { projectId: 'project', projectRoot: '/project', revision: 1, checkpoints: [] } as unknown as RoadmapIndex;
    const node = { id: 'prompt-16', kind: 'prompt', title: 'P16', taskSource: { stackPath: 'docs/tasks/c10-roadmap-create-sync',
        path: relative, fingerprint } } as CheckpointNode;
    model.setSnapshot('file:///project', index);
    model.selectTask(node);
    assert.equal(resolved, 0); // single click only selects
    assert.equal(model.selectedPrompt?.id, node.id);
    await model.openPrompt(); // inspector button or focused Enter
    assert.deepEqual(opened, ['file:///project/docs/tasks/c10-roadmap-create-sync/P16-prompt-source-navigation.txt']);
    assert.equal(model.selectedPrompt?.id, node.id);
    model.setSnapshot('file:///foreign', { ...index, projectId: 'foreign' });
    await model.openPrompt(node);
    assert.equal(opened.length, 1);
});

test('canvas has distinct click, double click and keyboard activation; inspector exposes accessible action', () => {
    const canvas = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/roadmap-canvas-widget.ts'), 'utf8');
    const inspector = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/roadmap-inspector-widget.ts'), 'utf8');
    assert.match(canvas, /onClick: event => \{ event\.stopPropagation\(\); data\.select\(item\.id\)/);
    assert.match(canvas, /onDoubleClick: event => \{ event\.stopPropagation\(\); data\.activate\(item\.id\)/);
    assert.match(canvas, /event\.key === 'Enter' && current/);
    assert.match(canvas, /if \(node\.kind === 'prompt'\) void this\.inspector\.openPrompt\(node\)/);
    assert.match(inspector, /Open Prompt/);
    assert.match(inspector, /aria-label.*Open prompt source/);
    assert.doesNotMatch(canvas, /runAgent|startWork|codexPhase|spawn\(/);
});
