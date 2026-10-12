import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('Session contracts and Node runtime are absent from production source and RPC registration', () => {
    for (const name of ['developer-session.ts', 'developer-session-service.ts'])
        assert.equal(existsSync(new URL(`packages/contracts/src/${name}`, root)), false, name);
    for (const name of ['backend', 'store', 'resolver', 'candidates'])
        assert.equal(existsSync(new URL(`packages/theia-extension/src/node/developer-session-${name}.ts`, root)), false, name);

    for (const packageName of readdirSync(new URL('packages/', root))) {
        const src = new URL(`packages/${packageName}/src/`, root);
        if (!existsSync(src)) continue;
        const visit = (directory: URL) => {
            for (const entry of readdirSync(directory, { withFileTypes: true })) {
                const location = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
                if (entry.isDirectory()) visit(location);
                else if (entry.name.endsWith('.ts'))
                    assert.doesNotMatch(readFileSync(location, 'utf8'),
                        /(?:developer-session(?:-service|-backend|-store|-resolver|-candidates)?|DeveloperSession|SessionArtifactRef)/,
                        location.pathname);
            }
        };
        visit(src);
    }
    const module = read('packages/theia-extension/src/node/backend-module.ts');
    assert.doesNotMatch(module, /developer-session|DeveloperSession|development-sessions/);
    const compiledModule = read('packages/theia-extension/lib/node/backend-module.js');
    assert.doesNotMatch(compiledModule, /developer-session|DeveloperSession|development-sessions/);
    assert.doesNotMatch(read('package.json'), /test\/unit\/developer-session-(?:contracts|store|backend|resolver|membership|integration|candidates)\.test\.ts/);
    assert.match(read('package.json'), /test\/unit\/developer-session-backend-retirement\.test\.ts/);
});

test('legacy source data has no product writer; persisted AgentTask origin remains readable', () => {
    const nodeSource = new URL('packages/theia-extension/src/node/', root);
    for (const name of readdirSync(nodeSource).filter(name => name.endsWith('.ts')))
        assert.doesNotMatch(readFileSync(new URL(name, nodeSource), 'utf8'), /development-sessions\.json/, name);
    const origin = read('packages/agent-core/src/contracts.ts');
    assert.match(origin, /'future-session': \['kind', 'sessionId'\]/);
    assert.match(origin, /'future-session'/);
    assert.match(read('scripts/export-legacy-development-sessions.mjs'), /development-sessions\.json/);
});
