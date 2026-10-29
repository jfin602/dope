import assert from 'node:assert/strict';
import test from 'node:test';
import { extractSavedRoadmap, roadmapCreationIntent } from '../../packages/theia-extension/lib/node/chat-roadmap-extract.js';
import type { Chat, ChatAssistantMessage } from '../../packages/chat/src/index.ts';

const source = (content: string) => ({ id: 'answer-1', role: 'assistant', content,
    execution: { status: 'complete' } }) as ChatAssistantMessage;
const chat = (answer: ChatAssistantMessage) => ({ messages: [
    { id: 'decision-1', role: 'user', content: 'I want a PixiJS 2D tower defense game with a fixed enemy path.' }, answer,
] }) as Chat;

test('natural Roadmap instruction is separate from quoted and ambiguous mention', () => {
    assert.equal(roadmapCreationIntent('Lets make a roadmap first'), 'create');
    assert.equal(roadmapCreationIntent('lets make a roadmap'), 'create');
    assert.equal(roadmapCreationIntent('create our roadmap'), 'create');
    assert.equal(roadmapCreationIntent('Roadmap'), 'ambiguous');
    assert.equal(roadmapCreationIntent('The model said "make a roadmap"'), undefined);
});

test('named implementation order wins over a competing feature inventory', () => {
    const answer = source('Core Components\n1. Towers\n2. Enemies\n\n**Implementation Order Recommendation:**\n1. Establish PixiJS scene\n2. Build fixed path\n3. Add kill income\n\nFirst Milestone (Vertical Slice):\n1. Prototype');
    const parsed = extractSavedRoadmap(chat(answer), answer, 'project-1', 0);
    assert.deepEqual(parsed.phases.map(item => item.title), ['Establish PixiJS scene', 'Build fixed path', 'Add kill income']);
    assert(parsed.phases.every(item => !item.checkpoints.length));
});

test('recommended implementation order wins over an earlier core systems list', () => {
    const answer = source('Core Systems to Implement First:\n1. Grid\n2. Enemies\n\nRecommended Implementation Order:\n1. Render a PixiJS map\n2. Move enemies on a fixed path\n3. Add persistent tower health\n\nFirst Milestone: Playable prototype');
    assert.deepEqual(extractSavedRoadmap(chat(answer), answer, 'project-1', 0).phases.map(item => item.title),
        ['Render a PixiJS map', 'Move enemies on a fixed path', 'Add persistent tower health']);
});

test('phase headings and supported bullets are extracted once without unsupported weeks', () => {
    const answer = source('Phase 1: PixiJS setup (Weeks 1–2)\n- Create scene\nPhase 2: Fixed path (Weeks 3–4)\n- Place route\n');
    const parsed = extractSavedRoadmap(chat(answer), answer, 'project-1', 0);
    assert.deepEqual(parsed.phases.map(item => item.title), ['PixiJS setup', 'Fixed path']);
    assert.deepEqual(parsed.phases.map(item => item.checkpoints[0].title), ['Create scene', 'Place route']);
    assert.match(answer.content, /Weeks 1–2/);
});

test('phase-only answer retains its saved objectives without inventing checkpoints', () => {
    const answer = source('Phase 1 — Core loop\nCreate a fixed enemy path.\n\nPhase 2 — Economy\n' +
        'Grant money from kills to buy towers and abilities.\nI can generate a draft for review.');
    const parsed = extractSavedRoadmap(chat(answer), answer, 'project-1', 0);
    assert.deepEqual(parsed.phases.map(item => item.objective),
        ['Create a fixed enemy path.', 'Grant money from kills to buy towers and abilities.']);
    assert(parsed.phases.every(item => item.checkpoints.length === 0));
});

test('incomplete, quoted and broken sequences fail closed', () => {
    for (const content of ['> Phase 1: First\n> Phase 2: Second', 'Phase 1: First\nPhase 3: Third',
        '1. First\n3. Third', 'Phase 1: First\nPhase 2: Second...']) {
        const answer = source(content);
        assert.throws(() => extractSavedRoadmap(chat(answer), answer, 'project-1', 0));
    }
});
