import assert from 'node:assert/strict';
import test from 'node:test';
import { roadmapRequirementCoverage } from '../../packages/theia-extension/lib/node/chat-roadmap-requirements.js';

const examples = [
    { label: 'PixiJS 2D', request: 'Use PixiJS for 2D rendering.', equivalent: 'Render the two-dimensional game with pixi.js.',
        unrelated: 'Use PixiJS for audio. Make the paper map 2D.' },
    { label: 'fixed enemy path', request: 'Enemies follow a fixed path.', equivalent: 'Use a predefined route for enemies.',
        unrelated: 'Enemies move freely. Keep a fixed camera path.' },
    { label: 'kill income', request: 'Collect money for killing enemies.', equivalent: 'Earn coins from defeated enemies.',
        unrelated: 'Kill enemies. Grant passive income each wave.' },
    { label: 'persistent main tower health', request: 'The main tower has persistent health throughout every wave.',
        equivalent: 'The base HP carries over between waves.',
        unrelated: 'Enemy health persists between waves. Reset main tower health each wave.' },
    { label: 'zero health means loss', request: 'If your tower health reaches 0 you lose.',
        equivalent: 'If my main tower reaches zero HP, the game is over.',
        unrelated: 'Enemy health reaches zero, but the player loses after three waves.' },
    { label: 'currency buys towers and abilities', request: 'Use your money to buy more towers and abilities.',
        equivalent: 'Spend coins to purchase towers and abilities.',
        unrelated: 'Earn money, buy towers, and give abilities for free.' },
] as const;

function status(label: string, requested: readonly string[], proposed: readonly string[]): string {
    return roadmapRequirementCoverage(requested, proposed).find(item => item.startsWith(`${label}: `))!;
}

test('each game requirement distinguishes covered, uncovered, absent, equivalent and unrelated wording', () => {
    for (const { label, request, equivalent, unrelated } of examples) {
        assert.equal(status(label, [request], [request]), `${label}: Covered`, label);
        assert.equal(status(label, [request], ['Build the basic game loop.']), `${label}: Uncovered`, label);
        assert.equal(status(label, ['Build a basic game loop.'], [request]), `${label}: Not in saved request`, label);
        assert.equal(status(label, [equivalent], [equivalent]), `${label}: Covered`, label);
        assert.equal(status(label, [request], [unrelated]), `${label}: Uncovered`, label);
        assert.equal(status(label, [unrelated], [request]), `${label}: Not in saved request`, label);
    }
});

test('zero-HP defeat recognizes natural orderings and rejects enemy, wave and negated losses', () => {
    const label = 'zero health means loss';
    for (const request of [
        'If your tower health reaches 0 you lose.',
        'If my main tower reaches zero HP, the game is over.',
        'You lose when the base health drops to zero.',
        'Defeat occurs when the main tower has no health remaining.',
        'When the main tower HP hits 0, the player loses.',
        'The game ends if the base is destroyed.',
    ]) assert.equal(status(label, [request], ['Build a basic game loop.']), `${label}: Uncovered`, request);
    for (const request of [
        'Enemy health reaches zero, but the player loses after three waves.',
        'Your tower has ten health and you lose after ten waves.',
        'You do not lose when tower health reaches zero.',
        'You do not lose when your tower health reaches zero.',
        'An enemy reaches zero HP and dies.',
    ]) assert.equal(status(label, [request], ['Your tower health reaches 0 and you lose.']),
        `${label}: Not in saved request`, request);
});

test('the exact P4 saved request has all six requirements and an incomplete proposal reports real gaps', () => {
    const request = "I want to make a 2D tower defense game with PixiJS. Let's do a fixed enemy path. You collect money for killing enemies. Your main tower has persistent health throughout every wave. If your tower health reaches 0 you lose. You use your money to buy more towers and abilities.";
    const phases = [
        'Set up PixiJS scene with basic game loop',
        'Implement enemy movement along fixed path',
        'Build core tower functionality with shooting mechanics',
        'Add resource collection and UI for money display',
        'Create tower purchasing system and upgrade abilities',
    ];
    const result = roadmapRequirementCoverage([request, 'Lets make a roadmap first'], phases);
    assert.equal(result.length, 6);
    assert.equal(result.some(item => item.endsWith('Not in saved request')), false);
    assert.ok(result.includes('zero health means loss: Uncovered'));
    assert.ok(result.includes('kill income: Uncovered'));
    assert.ok(result.includes('currency buys towers and abilities: Uncovered'));
});

test('a hedged tower defeat idea is shown for clarification instead of silently marked absent', () => {
    assert.equal(status('zero health means loss',
        ['Maybe the base should have a low-health defeat condition?'], ['The base loses at zero HP.']),
    'zero health means loss: Ambiguous in saved request — confirm with developer');
});
