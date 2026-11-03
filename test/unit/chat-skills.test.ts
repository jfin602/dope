import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { changeChatSkill, isBoundRoadmapSkill, listChatSkills, resolveChatSkill, skillCommand, validateSkill } from
    '../../packages/theia-extension/lib/node/chat-skills.js';
import { parseChatMessage } from '../../packages/chat/lib/index.js';

test('Dope skills validate, persist, protect built-ins, and bind exact turn snapshots', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dope-skills-'));
    const previous = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = directory;
    try {
        assert.throws(() => validateSkill('Bad-Name', 'description', 'body'));
        assert.throws(() => validateSkill('docs-apply', 'description', 'body'));
        assert.throws(() => validateSkill('a--b', 'description', 'body'));
        assert.throws(() => validateSkill('valid', '', 'body'));
        assert.throws(() => validateSkill('valid', 'description', 'body', ''));
        assert.throws(() => validateSkill('valid', 'description', 'x'.repeat(1501)));
        const builtIn = (await listChatSkills())[0];
        assert.equal(builtIn.provenance, 'builtin');
        const roadmap = (await listChatSkills()).find(item => item.name === 'roadmap')!;
        assert.equal(roadmap.provenance, 'builtin');
        assert.equal(roadmap.version, 2);
        assert.match(roadmap.body, /Roadmap Markers v1/);
        assert.doesNotMatch(roadmap.body, /native roadmap_read|bounded batches|gate\.create|JSON/);
        assert.equal(isBoundRoadmapSkill(await resolveChatSkill('/roadmap')), true);
        assert.equal(isBoundRoadmapSkill({ ...(await resolveChatSkill('/roadmap'))!, body: 'forged' }), false);
        assert.equal(isBoundRoadmapSkill({ ...(await resolveChatSkill('/roadmap'))!, version: 1 }), false);
        await assert.rejects(changeChatSkill({ type: 'delete', id: roadmap.id }));
        await assert.rejects(changeChatSkill({ type: 'add', name: 'roadmap', description: 'collision', body: 'body' }));
        await assert.rejects(changeChatSkill({ type: 'delete', id: builtIn.id }));
        await assert.rejects(changeChatSkill({ type: 'add', name: builtIn.name, description: 'collision', body: 'body' }));
        const added = await changeChatSkill({ type: 'add', name: 'test-skill', title: 'Test skill',
            description: 'Test summary', body: 'First body' });
        const custom = added.find(skill => skill.name === 'test-skill')!;
        assert.equal(custom.title, 'Test skill');
        assert.equal(JSON.parse(await readFile(join(directory, 'dope', 'chat-skills.json'), 'utf8')).length, 1);
        assert.equal((await listChatSkills()).find(skill => skill.id === custom.id)?.body, 'First body');
        const snapshot = await resolveChatSkill('/test-skill apply to earlier context');
        assert.equal(snapshot?.body, 'First body');
        assert.equal(snapshot?.title, 'Test skill');
        assert.equal(snapshot?.description, 'Test summary');
        assert.equal(snapshot?.version, 1);
        await changeChatSkill({ type: 'edit', id: custom.id, name: 'test-skill', title: 'Updated skill',
            description: 'Updated summary', body: 'Second body' });
        assert.equal(snapshot?.body, 'First body');
        assert.equal(snapshot?.title, 'Test skill');
        assert.equal((await resolveChatSkill('/test-skill'))?.body, 'Second body');
        const saved = parseChatMessage({ schemaVersion: 1, id: randomUUID(), role: 'user', createdAt: new Date().toISOString(),
            content: '/test-skill', contextRefs: [], skill: snapshot });
        assert.equal(saved.role === 'user' && saved.skill?.body, 'First body');
        assert.equal(saved.role === 'user' && saved.skill?.title, 'Test skill');
        assert.equal(saved.role === 'user' && saved.skill?.description, 'Test summary');
        await changeChatSkill({ type: 'enable', id: custom.id, enabled: false });
        await assert.rejects(resolveChatSkill('/test-skill'), /disabled/);
        await assert.rejects(resolveChatSkill('/unknown'), /Unknown skill/);
        assert.equal(skillCommand('/src/file'), undefined);
        assert.equal(skillCommand('literal /test-skill'), undefined);
        assert.equal(skillCommand('/test-skill arguments'), 'test-skill');
        await changeChatSkill({ type: 'delete', id: custom.id });
        assert.equal((await listChatSkills()).length, 2);
    } finally {
        if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
        else process.env.XDG_CONFIG_HOME = previous;
        await rm(directory, { recursive: true, force: true });
    }
});
