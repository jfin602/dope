import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExecutionGrant, parseExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection, parseWorkToolSelection, resolveWorkTools } from
    '../../packages/agent-core/lib/work-tool-selection.js';
import { WorkToolPreferences } from '../../packages/theia-extension/lib/browser/work-tool-preferences.js';

const target = { connectionId: 'local', modelId: 'model-1' };
const project = 'file:///tmp/dope-a';
const memory = () => {
    const values = new Map<string, string>();
    return { getItem(key: string) { return values.get(key) ?? null; },
        setItem(key: string, value: string) { values.set(key, value); } };
};

test('groups, individual overrides and command dependency resolve with denial precedence', () => {
    const groups = [{ id: 'small', name: 'Small', tools: ['read_file', 'edit_file'] }];
    const selected = resolveWorkTools({ groups: ['Inspect', 'small'], allow: ['run_command'],
        deny: ['read_file', 'run_command'] }, groups, true);
    assert.deepEqual(selected.tools, ['list_files', 'edit_file']);
    assert.deepEqual(resolveWorkTools({ groups: [], allow: ['read_command_output'], deny: [] }, [], true),
        { tools: [], unavailable: ['read_command_output: requires run_command'] });
    assert.deepEqual(resolveWorkTools({ groups: ['Commands'], allow: [], deny: [] }, [], false),
        { tools: [], unavailable: ['run_command: no approved task command',
            'read_command_output: no approved task command'] });
});

test('custom groups persist across instances while task and default choices stay project scoped', () => {
    const storage = memory();
    const first = new WorkToolPreferences(storage);
    first.upsertGroup({ id: 'small', name: 'Small', tools: ['read_file'] });
    first.saveDefault(project, { groups: ['small'], allow: [], deny: [] });
    first.saveChoice(project, 'task-a', { groups: ['Inspect'], allow: [], deny: ['read_file'] });
    const restarted = new WorkToolPreferences(storage);
    assert.deepEqual(restarted.groups().map(group => group.name), ['Small']);
    assert.deepEqual(restarted.resolve(project, 'task-a', true).tools, ['list_files']);
    assert.deepEqual(restarted.resolve(project, 'task-b', true).tools, ['read_file']);
    assert.deepEqual(restarted.resolve('file:///tmp/dope-b', 'task-a', true).tools,
        ['read_file', 'list_files', 'edit_file']);
    restarted.upsertGroup({ id: 'small', name: 'Small renamed', tools: ['edit_file'] });
    assert.deepEqual(restarted.resolve(project, 'task-b', true).tools, ['edit_file']);
});

test('optional validation leaves command tools out while preserving simple explicit choices', () => {
    const prefs = new WorkToolPreferences(memory());
    assert.deepEqual(prefs.resolve(project, 'direct', false).tools, ['read_file', 'list_files', 'edit_file']);
    prefs.saveChoice(project, 'direct', { groups: [], allow: ['read_file', 'run_command'], deny: [] });
    assert.deepEqual(prefs.resolve(project, 'direct', false).tools, ['read_file']);
    assert.deepEqual(prefs.resolve(project, 'direct', true).tools, ['read_file', 'run_command']);
});

test('saved approval freezes identities and rejects stale catalog, unknown tools and grant drift', () => {
    const frozen = makeWorkToolSelection({ projectUri: project, taskId: 'task-a', grantRevision: 1,
        ...target }, ['read_file']);
    const grant = createDefaultExecutionGrant({ id: 'grant-a', revision: 1, taskId: 'task-a',
        acceptedAt: new Date().toISOString(), toolSelection: frozen });
    assert.deepEqual(grant.toolSelection?.tools.map(tool => tool.id), ['read_file']);
    assert.throws(() => parseWorkToolSelection({ ...frozen, catalogRevision: 999 }));
    assert.throws(() => parseWorkToolSelection({ ...frozen, tools: [{ id: 'future_tool', schemaRevision: 1 }] }));
    assert.throws(() => parseWorkToolSelection({ ...frozen, tools: [{ id: 'read_file', schemaRevision: 2 }] }));
    assert.throws(() => parseExecutionGrant({ ...grant, revision: 2 }));
    assert.throws(() => parseWorkToolSelection({ ...frozen, tools: [
        { id: 'read_command_output', schemaRevision: 1 }] }));
});

test('a removed group cannot silently expand a draft or produce an approved run', () => {
    const prefs = new WorkToolPreferences(memory());
    prefs.upsertGroup({ id: 'custom', name: 'Custom', tools: ['read_file'] });
    prefs.saveChoice(project, 'retry:1', { groups: ['custom'], allow: [], deny: [] });
    prefs.deleteGroup('custom');
    assert.match(prefs.resolve(project, 'retry:1', true).unavailable[0], /unknown or changed tool/);
    assert.throws(() => prefs.snapshot(project, 'retry:1', 'new-task', 2, target, true));
});
