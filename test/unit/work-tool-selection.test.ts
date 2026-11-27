import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExecutionGrant, parseExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection, parseWorkToolSelection, resolveWorkTools, workToolCatalogFor } from
    '../../packages/agent-core/lib/work-tool-selection.js';
import { WorkToolPreferences, hasApprovedWorkCommand } from '../../packages/theia-extension/lib/browser/work-tool-preferences.js';

const target = { connectionId: 'local', modelId: 'model-1' };
const project = 'file:///tmp/dope-a';
const memory = () => {
    const values = new Map<string, string>();
    return { getItem(key: string) { return values.get(key) ?? null; },
        setItem(key: string, value: string) { values.set(key, value); } };
};

test('command tools require a validation shape accepted by the sandbox broker', () => {
    assert.equal(hasApprovedWorkCommand('node --test check.test.js'), true);
    assert.equal(hasApprovedWorkCommand('node check.js'), false);
    assert.equal(hasApprovedWorkCommand('node check.js', 'build'), true);
    assert.equal(hasApprovedWorkCommand('node --test ../outside.test.js'), false);
    assert.equal(hasApprovedWorkCommand('node --test check.js'), false);
    assert.equal(hasApprovedWorkCommand('node --test secret.test.js'), false);
    assert.equal(hasApprovedWorkCommand('node --test check.test.js;rm'), false);
});

test('groups, individual overrides and command dependency resolve with denial precedence', () => {
    const groups = [{ id: 'small', name: 'Small', tools: ['read', 'edit'] }];
    const selected = resolveWorkTools({ groups: ['Inspect', 'small'], allow: ['run_command'],
        deny: ['read', 'run_command'] }, groups, true);
    assert.deepEqual(selected.tools, ['ls', 'edit']);
    assert.deepEqual(resolveWorkTools({ groups: [], allow: ['read_command_output'], deny: [] }, [], true),
        { tools: [], unavailable: ['read_command_output: requires run_command'] });
    assert.deepEqual(resolveWorkTools({ groups: ['Commands'], allow: [], deny: [] }, [], false),
        { tools: [], unavailable: ['run_command: no approved task command',
            'read_command_output: no approved task command'] });
});

test('trusted Work catalog includes the reviewed MCP observation with project and consent reasons', () => {
    const unavailable = workToolCatalogFor({ locality: 'local', commandsAvailable: false,
        externalOffered: false, externalConsent: false });
    assert.equal(unavailable.length, 7);
    assert.equal(unavailable.find(tool => tool.id === 'mcp_godot_server_info')?.available, false);
    assert.match(unavailable.find(tool => tool.id === 'mcp_godot_server_info')?.unavailableReason ?? '',
        /inactive for this project/);
    assert.match(unavailable.find(tool => tool.id === 'run_command')?.unavailableReason ?? '', /approved task command/);
    const offered = workToolCatalogFor({ locality: 'local', commandsAvailable: true,
        externalOffered: true, externalConsent: true });
    assert.equal(offered.find(tool => tool.id === 'mcp_godot_server_info')?.available, true);
    assert.deepEqual(resolveWorkTools({ groups: ['Inspect'], allow: ['mcp_godot_server_info'], deny: [] },
        [], true, true).tools, ['read', 'ls', 'mcp_godot_server_info']);
    assert.match(resolveWorkTools({ groups: [], allow: ['mcp_godot_server_info'], deny: [] },
        [], true, false).unavailable[0], /observation consent missing/);
    assert.deepEqual(resolveWorkTools({ groups: ['external'], allow: [], deny: ['mcp_godot_server_info'] },
        [{ id: 'external', name: 'External', tools: ['mcp_godot_server_info'] }], true, false),
    { tools: [], unavailable: [] }, 'an explicit denial keeps an unavailable group tool out of Work');
});

test('custom groups persist across instances while task and default choices stay project scoped', () => {
    const storage = memory();
    const first = new WorkToolPreferences(storage);
    first.upsertGroup({ id: 'small', name: 'Small', tools: ['read'] });
    first.saveDefault(project, { groups: ['small'], allow: [], deny: [] });
    first.saveChoice(project, 'task-a', { groups: ['Inspect'], allow: [], deny: ['read'] });
    const restarted = new WorkToolPreferences(storage);
    assert.deepEqual(restarted.groups().map(group => group.name), ['Small']);
    assert.deepEqual(restarted.resolve(project, 'task-a', true).tools, ['ls']);
    assert.deepEqual(restarted.resolve(project, 'task-b', true).tools, ['read']);
    assert.deepEqual(restarted.resolve('file:///tmp/dope-b', 'task-a', true).tools,
        ['read', 'ls', 'write', 'edit']);
    restarted.upsertGroup({ id: 'small', name: 'Small renamed', tools: ['edit'] });
    assert.deepEqual(restarted.resolve(project, 'task-b', true).tools, ['edit']);
});

test('optional validation leaves command tools out while preserving simple explicit choices', () => {
    const prefs = new WorkToolPreferences(memory());
    assert.deepEqual(prefs.resolve(project, 'direct', false).tools, ['read', 'ls', 'write', 'edit']);
    prefs.saveChoice(project, 'direct', { groups: [], allow: ['read', 'run_command'], deny: [] });
    assert.deepEqual(prefs.resolve(project, 'direct', false).tools, ['read']);
    assert.deepEqual(prefs.resolve(project, 'direct', true).tools, ['read', 'run_command']);
});

test('a saved legacy file choice requires review before a new Work approval', () => {
    const prefs = new WorkToolPreferences(memory());
    prefs.saveChoice(project, 'legacy', { groups: [], allow: ['read_file', 'edit_file'], deny: [] });
    assert.deepEqual(prefs.resolve(project, 'legacy', true).tools, []);
    assert.match(prefs.resolve(project, 'legacy', true).unavailable.join(' '), /previous Work file tool/);
    assert.throws(() => prefs.snapshot(project, 'legacy', 'new-task', 0, target, true),
        /Review unavailable Work tools/);
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
    assert.deepEqual(parseWorkToolSelection({ ...frozen, catalogRevision: 1 }).tools,
        frozen.tools, 'historical built-in selections remain readable');
    assert.throws(() => parseWorkToolSelection({ ...frozen, catalogRevision: 1,
        tools: [{ id: 'mcp_godot_server_info', schemaRevision: 1 }] }));
});

test('a removed group cannot silently expand a draft or produce an approved run', () => {
    const prefs = new WorkToolPreferences(memory());
    prefs.upsertGroup({ id: 'custom', name: 'Custom', tools: ['read_file'] });
    prefs.saveChoice(project, 'retry:1', { groups: ['custom'], allow: [], deny: [] });
    prefs.deleteGroup('custom');
    assert.match(prefs.resolve(project, 'retry:1', true).unavailable[0], /unknown or changed tool/);
    assert.throws(() => prefs.snapshot(project, 'retry:1', 'new-task', 2, target, true));
});
