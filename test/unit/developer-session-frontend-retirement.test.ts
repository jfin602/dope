import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const browser = new URL('../../packages/theia-extension/src/browser/', import.meta.url);
const source = (file: string) => readFileSync(new URL(file, browser), 'utf8');

test('retired Session workspace has no frontend module, factory, launcher, command or CSS', () => {
    for (const name of ['developer-session-widget.ts', 'developer-session-controller.ts',
        'developer-session-navigation.ts', 'developer-session-presentation.ts']) {
        assert.equal(existsSync(new URL(name, browser)), false, `${name} must stay retired`);
    }
    const module = source('frontend-module.ts');
    assert.doesNotMatch(module, /developer-session|DeveloperSession|SessionsLauncher|dope\.sessions\.open|dope-developer-sessions/);
    assert.doesNotMatch(source('dope.css'), /dope-session-(?:view|layout|row|launcher)/);
    const productScript = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
    assert.match(productScript, /test\/unit\/developer-session-frontend-retirement\.test\.ts/);
    assert.doesNotMatch(productScript, /test\/unit\/developer-session-(?:widget|navigation|ui-controller|ui-membership)\.test\.ts/);
});

test('Chat and Work launchers, owners, and Planning map registration remain available', () => {
    const module = source('frontend-module.ts');
    for (const name of ['LeftChatLauncher', 'RightChatLauncher', 'LeftWorkLauncher', 'RightWorkLauncher']) {
        assert.match(module, new RegExp(`bindViewContribution\\(bind, ${name}\\)`));
        assert.match(module, new RegExp(`toService\\(${name}\\)`));
    }
    for (const name of ['ChatOpenOwners', 'WorkOpenOwners', 'PlanningMapController'])
        assert.match(module, new RegExp(`bind\\(${name}\\)`));
    assert.match(module, /id: PHYSICAL_MAP_ID, createWidget:/);
    assert.match(module, /id: PROJECT_MIND_ID, createWidget:/);
    assert.match(module, /id: CHAT_PANEL_ID, createWidget:/);
});
