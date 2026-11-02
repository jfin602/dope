import assert from 'node:assert/strict';
import test from 'node:test';
import { ReasoningRevealBuffer } from '../../packages/theia-extension/lib/browser/reasoning-reveal.js';
import { ChatScrollFollow } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import { parseChatSettings } from '../../packages/chat/lib/index.js';

test('paragraph presentation releases complete blocks and flushes cancellation tails exactly once', () => {
    const buffer = new ReasoningRevealBuffer('paragraphs');
    assert.deepEqual(buffer.update('First **bold**'), []);
    assert.deepEqual(buffer.update('First **bold**.\n\nSecond'), ['First **bold**.\n\n']);
    assert.deepEqual(buffer.update('First **bold**.\n\nSecond line'), []);
    assert.deepEqual(buffer.flush(), ['Second line']);
    assert.deepEqual(buffer.flush(), []);
});

test('long prose progresses at sentence boundaries and fenced Markdown stays whole', () => {
    const sentence = 'A readable sentence with several words. ';
    const text = sentence.repeat(16);
    const buffer = new ReasoningRevealBuffer('paragraphs');
    const chunks = buffer.update(text);
    assert.ok(chunks.length >= 1);
    assert.ok(chunks.every(chunk => chunk.endsWith(' ')));
    assert.equal(chunks.join('') + buffer.flush().join(''), text);
    const code = new ReasoningRevealBuffer('short-chunks');
    assert.deepEqual(code.update('```ts\n' + 'const value = 1;\n'.repeat(20)), []);
    const full = '```ts\n' + 'const value = 1;\n'.repeat(20) + '```\n\n';
    assert.deepEqual(code.update(full), [full]);
    const list = new ReasoningRevealBuffer('short-chunks');
    const items = '- ' + 'first item '.repeat(12) + '\n- ' + 'second item '.repeat(12) + '\n';
    const listChunks = [...list.update(items), ...list.flush()];
    assert.equal(listChunks.join(''), items);
    assert.ok(listChunks.every(chunk => !chunk.endsWith('first item ')));
});

test('short chunks and live tokens retain order without dropping stream tails', () => {
    const input = 'Word '.repeat(100);
    for (const mode of ['short-chunks', 'live-tokens'] as const) {
        const buffer = new ReasoningRevealBuffer(mode);
        const output = [ ...buffer.update(input.slice(0, 120)),
            ...buffer.update(input), ...buffer.flush() ].join('');
        assert.equal(output, input);
        assert.throws(() => buffer.update('different stream'));
    }
});

test('scroll follow stops and resumes only when user returns to the bottom', () => {
    const follow = new ChatScrollFollow();
    follow.select('chat-1');
    follow.scrolled(200, 1000, 300);
    assert.equal(follow.following, false);
    assert.equal(follow.restore(200, 1400, 300), 200);
    follow.scrolled(1095, 1400, 300);
    assert.equal(follow.following, true);
    assert.equal(follow.restore(1095, 1600, 300), 1600);
    follow.select('chat-2');
    assert.equal(follow.following, true);
});

test('reasoning display preferences round trip through Chat settings validation', () => {
    const settings = { schemaVersion: 1, modelPolicy: { type: 'follow-interactive' },
        context: { maxInputTokens: 8192, reservedOutputTokens: 1024, history: 'recent',
            savedChatSearch: false, allowedSources: [] },
        reasoningDisplay: { mode: 'short-chunks', fadeIn: false } };
    assert.deepEqual(parseChatSettings(settings).reasoningDisplay, settings.reasoningDisplay);
    assert.throws(() => parseChatSettings({ ...settings,
        reasoningDisplay: { mode: 'fast', fadeIn: true } }));
});
