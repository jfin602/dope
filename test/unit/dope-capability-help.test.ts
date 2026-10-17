import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { DOPE_CAPABILITY_HELP, DOPE_CAPABILITY_HELP_VERSION, projectDopeCapabilityHelp, selectDopeCapabilityHelp } from
    '../../packages/theia-extension/src/node/dope-capability-help.ts';

const root = new URL('../../', import.meta.url).pathname;
const source = (file: string) => readFileSync(join(root, 'packages/theia-extension/src/browser', file), 'utf8');
const roadmap = source('roadmap-canvas-widget.ts');
const chat = source('chat-panel-widget.ts');
const center = source('ai-center-contribution.ts');
const registrations = source('frontend-module.ts');
const history = source('history-widget.ts');
const byId = (id: string) => DOPE_CAPABILITY_HELP.find(entry => entry.id === id)!;

test('help labels and routes match current UI controls and command registrations', () => {
    assert.equal(DOPE_CAPABILITY_HELP_VERSION, '0.11.5');
    assert.equal(new Set(DOPE_CAPABILITY_HELP.map(entry => entry.id)).size, DOPE_CAPABILITY_HELP.length);
    assert.match(roadmap, /icon\(this\.reload, 'Refresh Roadmap'/);
    assert.match(roadmap, /icon\(this\.sourceButton, 'Roadmap Markdown and setup'/);
    assert.match(roadmap, /change\.textContent = 'Change linked file'/);
    assert.match(roadmap, /sourceState === 'source-changed'/);
    assert.match(roadmap, /sourceState === 'conflict'/);
    assert.match(roadmap, /sourceState === 'relink-needed'/);
    assert.match(roadmap, /linkedDocument\?\.pending/);
    assert.match(chat, /menuButton\('Follow active planning selection'/);
    assert.match(chat, /this\.button\('Pin selected checkpoint \/ Planning Map'/);
    assert.match(chat, /!state\.workspace \|\| !this\.planningSelection\?\.current\(state\.workspace\)/);
    assert.match(center, /AI_CENTER_COMMAND = 'dope\.aiCenter\.open'/);
    assert.match(center, /label: 'Open AI Center'/);
    assert.match(center, /title:[\s\S]*?'AI Center'/);
    assert.match(registrations, /id: 'dope\.work\.open', label: 'Dope: Open Work'/);
    assert.match(registrations, /id: 'dope\.history\.open', label: 'Dope: Open History'/);
    assert.match(history, /aria-label', 'Refresh History'/);
    for (const entry of DOPE_CAPABILITY_HELP) {
        assert.ok(entry.goal && entry.uiPath && entry.limitation && entry.recovery, entry.id);
        assert.ok(!/shell|terminal command|run a tool/i.test(entry.uiPath), entry.id);
    }
    assert.match(byId('roadmap-change-file').uiPath, /Roadmap Markdown and setup > Change linked file/);
    assert.match(byId('roadmap-refresh').uiPath, /Refresh Roadmap/);
    assert.match(byId('chat-follow').uiPath, /Follow active planning selection/);
    assert.match(byId('chat-pin').uiPath, /Pin selected checkpoint \/ Planning Map/);
    assert.match(byId('ai-center').uiPath, /Open AI Center/);
});

test('missing feature, unavailable project and denied Roadmap permission never advertise availability', () => {
    const ready = { projectOpen: true, canWriteRoadmap: true, hasPlanningSelection: true };
    const missing = projectDopeCapabilityHelp({ ...ready, features: new Set(['roadmap-refresh'] as const) });
    assert.equal(missing.find(entry => entry.id === 'roadmap-change-file')?.available, false);
    assert.match(missing.find(entry => entry.id === 'roadmap-change-file')?.unavailableReason ?? '', /feature is unavailable/);
    assert.equal(missing.find(entry => entry.id === 'roadmap-refresh')?.available, true);

    const noProject = projectDopeCapabilityHelp({ ...ready, projectOpen: false });
    for (const id of ['roadmap-change-file', 'roadmap-refresh', 'chat-follow', 'chat-pin', 'work', 'history'])
        assert.match(noProject.find(entry => entry.id === id)?.unavailableReason ?? '', /Open one project/);
    assert.equal(noProject.find(entry => entry.id === 'ai-center')?.available, true);

    const denied = projectDopeCapabilityHelp({ ...ready, canWriteRoadmap: false });
    assert.match(denied.find(entry => entry.id === 'roadmap-change-file')?.unavailableReason ?? '', /owner permission/);
    assert.equal(denied.find(entry => entry.id === 'roadmap-refresh')?.available, true);
    assert.match(byId('roadmap-change-file').limitation, /Chat cannot change the link/);
    assert.match(byId('work').limitation, /separate execution and approval authority/);
    assert.equal(projectDopeCapabilityHelp({ ...ready, hasPlanningSelection: false })
        .find(entry => entry.id === 'chat-pin')?.available, false);
});

test('Roadmap source replacement intent is recognized without a literal file noun', () => {
    const questions = [
        'I linked the wrong Roadmap, how do I change it?',
        'i LINKED the wrong roadmap! How do I change it?',
        'How do I change the linked Roadmap?',
        'I selected the wrong Roadmap. How can I change it?',
        'I selected the wrong document for my Roadmap. How do I change it?',
        'I linked the wrong document to the Roadmap. Can I change it?',
        'How can I switch my Roadmap?',
        'How do I switch to a different Roadmap?',
        'Can I replace the linked Roadmap?',
        'How do I unlink the Roadmap?',
        'Where can I relink the Roadmap?',
        'Where can I relink a different Roadmap?',
        'How do I change the linked Roadmap file in Dope?',
        'How do I change the Roadmap Markdown source?',
        'How do I replace the Roadmap document?'
    ];
    for (const question of questions)
        assert.equal(selectDopeCapabilityHelp(question), 'roadmap-change-file', question);
});

test('Roadmap source guidance does not take planning edits, factual turns or other UI tasks', () => {
    const cases: readonly (readonly [string, ReturnType<typeof selectDopeCapabilityHelp>])[] = [
        ['Change the Roadmap checkpoint Objective', undefined],
        ['Replace the title of my Roadmap checkpoint', undefined],
        ['Switch the Roadmap checkpoint status', undefined],
        ['What is the progress of my Roadmap?', undefined],
        ['What changed in the Roadmap this week?', undefined],
        ['How do I change the linked issue on my Roadmap?', undefined],
        ['How do I replace the Roadmap link to my Planning Map?', undefined],
        ['How do I change the source link in this web page?', undefined],
        ['How do I refresh the Roadmap?', 'roadmap-refresh'],
        ['How do I sync the linked Roadmap file?', 'roadmap-refresh'],
        ['The Roadmap source changed; how do I refresh it?', 'roadmap-refresh'],
        ['How do I pin the selected checkpoint in Chat?', 'chat-pin'],
        ['How do I follow the active planning selection in Chat?', 'chat-follow'],
        ['Open my saved Work', 'work'],
        ['Find my History', 'history'],
        ['Tell me about TypeScript generics', undefined]
    ];
    for (const [question, expected] of cases)
        assert.equal(selectDopeCapabilityHelp(question), expected, question);
});
