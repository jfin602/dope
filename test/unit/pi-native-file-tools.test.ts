import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection } from '../../packages/agent-core/lib/work-tool-selection.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { DirectWorkJournal } from '../../packages/agent-core/lib/node/direct-work-journal.js';
import { brokerIsolatedFileOperation } from '../../packages/agent-core/lib/node/isolated-file-operations.js';
import { brokerPiFileOperation } from '../../packages/theia-extension/lib/node/local-agent-turn-loop.js';

const exec = promisify(execFile);
for (const mode of ['isolated', 'direct'] as const) test(`selected Pi file adapter uses whole ${mode} operations`,
    { timeout: 60_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), `dope-pi-native-${mode}-`));
    let workspace: ExecutionWorkspace | undefined;
    try {
        await mkdir(join(root, 'src'));
        await writeFile(join(root, 'src', 'base.txt'), '\ufeffone\r\ntwo\r\n');
        await writeFile(join(root, 'src', 'sensitive.txt'), 'api_key=fixture-only-value\n');
        await exec('git', ['init', '-q', root]);
        await exec('git', ['add', 'src/base.txt', 'src/sensitive.txt'], { cwd: root });
        await exec('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'fixture'], { cwd: root });
        const head = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
        workspace = await ExecutionWorkspace.create(root);
        const taskId = 'pi-native-task', runId = 'pi-native-run';
        const grant = createDefaultExecutionGrant({ id: 'pi-native-grant', revision: 0, taskId,
            acceptedAt: new Date().toISOString(), toolSelection: makeWorkToolSelection({
                projectUri: pathToFileURL(root).href, taskId, grantRevision: 0,
                connectionId: 'local', modelId: 'model', grantId: 'pi-native-grant',
                executionMode: mode }, ['read', 'ls', 'write', 'edit']) });
        const journal = mode === 'direct' ? await DirectWorkJournal.create(root, head, taskId, runId, grant) : undefined;
        if (journal) workspace.bindDirectBasis(journal);
        const request: any = { projectRoot: root, executionRoot: workspace.root, executionMode: mode,
            grant, taskId, runId, connectionId: 'local', registrationId: 'local', modelId: 'model',
            prompt: 'Edit source', onEvent() {} };
        const direct = journal ? { journal, unsaved: async () => false, refresh: async () => true } : undefined;
        const call = (operation: any, req = request, signal = new AbortController().signal) =>
            brokerPiFileOperation(req, workspace!, direct, operation, signal);
        if (direct) {
            const unsaved = await brokerPiFileOperation(request, workspace, { ...direct,
                unsaved: async () => true }, { id: 'buffer', kind: 'write', path: 'src/base.txt',
                content: 'replacement\n' }, new AbortController().signal);
            assert.equal(unsaved.status, 'failed');
            assert.match(unsaved.output, /^SOURCE_CONFLICT:/);
            assert.equal(await readFile(join(root, 'src/base.txt'), 'utf8'), '\ufeffone\r\ntwo\r\n');
        }
        assert.match((await call({ id: 'r1', kind: 'read', path: 'src/base.txt' })).output, /one\r\ntwo/);
        assert.equal((await call({ id: 'r2', kind: 'read', path: 'src/sensitive.txt' })).status, 'denied');
        assert.match((await call({ id: 'missing', kind: 'read', path: 'src/missing.txt' })).output,
            /^MISSING_FILE:/);
        assert.match((await call({ id: 'missing-dir', kind: 'ls', path: 'absent' })).output,
            /^MISSING_DIRECTORY:/);
        assert.match((await call({ id: 'l1', kind: 'ls', path: 'src' })).output, /base\.txt/);
        assert.equal((await call({ id: 'w1', kind: 'write', path: 'new/deep.txt', content: 'first\n' })).status,
            'completed');
        assert.equal((await call({ id: 'w2', kind: 'write', path: 'new/deep.txt', content: 'second\n' })).status,
            'completed');
        assert.equal((await call({ id: 'e1', kind: 'edit', path: 'new/deep.txt', edits: [
            { oldText: 'second', newText: 'third' }] })).status, 'completed');
        assert.equal(await readFile(join(workspace.root, 'new/deep.txt'), 'utf8'), 'third\n');
        assert.equal((await call({ id: 'e2', kind: 'edit', path: 'src/base.txt', edits: [
            { oldText: 'one\ntwo', newText: 'red\nblue' }] })).status, 'completed');
        assert.equal(await readFile(join(workspace.root, 'src/base.txt'), 'utf8'), '\ufeffred\r\nblue\r\n');
        assert.equal((await call({ id: 'bad1', kind: 'edit', path: 'src/base.txt', edits: [
            { oldText: 'absent', newText: 'x' }] })).status, 'failed');
        assert.match((await call({ id: 'bad1-feedback', kind: 'edit', path: 'src/base.txt', edits: [
            { oldText: 'absent', newText: 'x' }] })).output, /^EDIT_MATCH_CONFLICT:/);
        if (mode === 'isolated') {
            assert.equal((await brokerIsolatedFileOperation(request, workspace, { kind: 'write',
                path: 'src/base.txt', content: 'x', expectedSourceHash: null })).output, 'EXISTING_TARGET');
            assert.equal((await brokerIsolatedFileOperation(request, workspace, { kind: 'write',
                path: 'src/base.txt', content: 'x', expectedSourceHash: '0'.repeat(64) })).output, 'STALE_SOURCE');
        }
        assert.equal((await call({ id: 'bad2', kind: 'write', path: '.git/config', content: 'x' })).status,
            'denied');
        assert.equal((await call({ id: 'bad3', kind: 'write', path: '../escape', content: 'x' })).status,
            'denied');
        assert.equal((await call({ id: 'bad4', kind: 'write', path: 'huge/file', content: 'x'.repeat(65537) })).status,
            'denied');
        assert.equal((await call({ id: 'unselected', kind: 'write', path: 'new/other.txt', content: 'x' },
            { ...request, grant: { ...grant, toolSelection: { ...grant.toolSelection,
                tools: grant.toolSelection!.tools.filter(tool => tool.id !== 'write') } } })).status, 'denied');
        const forged = { id: 'forged', kind: 'write', path: 'new/forged.txt', content: 'x' };
        for (const selection of [
            { ...grant.toolSelection, grantId: 'other-grant' },
            { ...grant.toolSelection, executionMode: mode === 'direct' ? 'isolated' : 'direct' },
            { ...grant.toolSelection, tools: grant.toolSelection!.tools.map(tool =>
                tool.id === 'write' ? { ...tool, schemaHash: '0'.repeat(64) } : tool) }
        ]) assert.equal((await call(forged, { ...request, grant: { ...grant,
            toolSelection: selection } })).status, 'denied');
        assert.equal(await readFile(join(workspace.root, 'new/forged.txt'), 'utf8').catch(() => ''), '');
        const aborted = new AbortController(); aborted.abort();
        assert.equal((await call({ id: 'stopped', kind: 'write', path: 'stopped/file', content: 'x' },
            request, aborted.signal)).status, 'cancelled');
        assert.equal(await readFile(join(root, 'new/deep.txt'), 'utf8').catch(() => ''),
            mode === 'direct' ? 'third\n' : '');
        if (journal) assert.equal(journal.changes.filter(change => change.result === 'completed').length, 4);
        const competing = mode === 'direct' ? join(root, 'src/base.txt') :
            join(workspace.root, 'src/base.txt');
        await writeFile(competing, 'owner replacement\n');
        assert.notEqual((await call({ id: 'race', kind: 'edit', path: 'src/base.txt', edits: [
            { oldText: 'red', newText: 'green' }] })).status, 'completed');
        assert.equal(await readFile(competing, 'utf8'), 'owner replacement\n');
    } finally { await workspace?.dispose(); await rm(root, { recursive: true, force: true }); }
});
