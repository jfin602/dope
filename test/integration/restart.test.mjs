import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { queryArtifacts } from '../../packages/project-intelligence/lib/index.js';

const root = resolve(import.meta.dirname, '../..');
const executable = join(root, 'node_modules/.bin/electron');

async function availablePort() {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

async function until(action, timeout = 30000) {
    const deadline = Date.now() + timeout;
    let lastError;
    while (Date.now() < deadline) {
        try {
            const result = await action();
            if (result) return result;
        } catch (error) { lastError = error; }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out after ${timeout}ms: ${lastError ?? 'no result'}`);
}

async function command(page, method, params) {
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    try {
        return await new Promise((resolve, reject) => {
            socket.onmessage = event => {
                const response = JSON.parse(event.data);
                if (response.id === 1) response.error ? reject(Error(response.error.message)) : resolve(response.result);
            };
            socket.onerror = reject;
            socket.send(JSON.stringify({ id: 1, method, params }));
        });
    } finally {
        socket.close();
    }
}

async function evaluate(page, expression) {
    const response = await command(page, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw Error(response.exceptionDetails.text + ': ' + response.exceptionDetails.exception?.description);
    return response.result.value;
}

async function launch(directory, port, workspace, extension) {
    const args = [join(root, 'apps/electron/src-gen/backend/electron-main.js'), '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
        `--electron-user-data=${join(directory, 'profile')}`, `--plugins=local-dir:${join(root, 'plugins')}`];
    if (extension) args.push(`--install-plugin=${extension}`);
    if (workspace) args.push(workspace);
    const child = spawn('xvfb-run', ['-a', executable, ...args], {
        cwd: root, env: { ...process.env, THEIA_CONFIG_DIR: join(directory, 'config') }, stdio: ['ignore', 'pipe', 'pipe'], detached: true
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    try {
        const page = await until(async () => {
            if (child.exitCode !== null || child.signalCode !== null) throw Error(output);
            const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            const candidate = pages.find(value => value.type === 'page' && value.url.includes('lib/frontend/index.html'));
            if (candidate && await evaluate(candidate, `(() => {
                const container = window.theia?.container;
                const key = [...(container?._bindingDictionary._map.entries() ?? [])].find(([, bindings]) =>
                    bindings.some(binding => binding.implementationType?.prototype?.reachedState))?.[0];
                return key && container.get(key).state === 'ready';
            })()`)) return candidate;
        }, 45000);
        return { child, page, get output() { return output; } };
    } catch (error) {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { }
        throw Error(`${error}\n${output}`);
    }
}

async function close(instance) {
    if (instance.child.exitCode !== null || instance.child.signalCode !== null) return;
    await evaluate(instance.page, 'window.electronTheiaCore.close()');
    await until(() => instance.child.exitCode !== null || instance.child.signalCode !== null, 15000);
}

test('Electron restart preserves Theia state and runtime extension, with stale-state fallback', { timeout: 150000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dope-restart-'));
    const workspace = join(directory, 'workspace');
    await mkdir(workspace);
    await writeFile(join(workspace, 'README.md'), 'A restorable editor\n');
    await mkdir(join(workspace, 'tests with spaces'));
    await writeFile(join(workspace, 'tests with spaces/sample.test.js'), await readFile(join(root, 'test/fixtures/ide-testing/sample.test.js')));
    const vsix = join(directory, 'uppercase.vsix');
    const zipped = spawnSync('zip', ['-q', '-r', vsix, 'extension', 'extension.vsixmanifest'], { cwd: join(root, 'test/fixtures/restart-extension') });
    assert.equal(zipped.status, 0, zipped.stderr.toString());
    const port = await availablePort();
    let instance;
    try {
        instance = await launch(directory, port, workspace, vsix);
        assert.match(instance.page.url, /#.*workspace$/);
        assert.equal(await evaluate(instance.page, `document.title.includes('workspace')`), true);
        assert.equal(await evaluate(instance.page, `(() => { const entries = [...theia.container._bindingDictionary._map.entries()]; return theia.container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.loadUserTheme))[0]).getCurrentTheme().id; })()`), 'dark');
        assert.equal(await evaluate(instance.page, `(() => { const button = [...document.querySelectorAll('button')].find(value => value.textContent.includes('Yes, I trust the authors')); if (!button) return false; button.click(); return true; })()`), true);
        assert.equal(await until(() => evaluate(instance.page, `(() => { const container = theia.container; const entry = [...container._bindingDictionary._map.entries()].find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.ensureCommandHandlerRegistration)); return container.get(entry[0]).contributions.get('dope-evidence.uppercase')?.state === 4; })()`)), true);
        const first = await evaluate(instance.page, `(async () => {
            const container = theia.container;
            const entries = [...container._bindingDictionary._map.entries()];
            const named = name => container.get(entries.find(([key]) => key.description === name)[0]);
            const typed = method => container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.[method]))[0]);
            const preference = named('PreferenceService');
            await preference.set('workbench.colorTheme', 'light', 1);
            await preference.set('editor.fontSize', 17, 1);
            await typed('setKeybinding').setKeybinding({ command: 'dope.projectMind.open', keybinding: 'ctrl+alt+shift+m' });
            const editorManager = typed('handleNewPreview');
            await editorManager.open(typed('doGetDefaultWorkspaceUri').workspace.resource.resolve('README.md'), { preview: false });
            await named('CommandService').executeCommand('dope.projectMind.open');
            return { theme: preference.get('workbench.colorTheme'), activeTheme: typed('loadUserTheme').getCurrentTheme().id,
                editor: editorManager.currentEditor?.title.label,
                mind: !!document.getElementById('dope-project-mind') };
        })()`);
        assert.equal(first.theme, 'light');
        assert.equal(first.activeTheme, 'light');
        assert.equal(await until(() => evaluate(instance.page, `[...document.querySelectorAll('.lm-TabBar-tabLabel')].some(node => node.textContent === 'README.md')`)), true);
        assert.equal(first.mind, true);
        assert.equal(await until(() => evaluate(instance.page, `theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'CommandService')).executeCommand('dope-evidence.uppercase', 'restart')`), 12000), 'RESTART');
        // Exercise the bundled provider, including filenames that need shell quoting only in a shell.
        await until(() => evaluate(instance.page, `(() => {
            const service = theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'TestService'));
            const controller = service.getControllers().find(value => value.id === 'jestVitestTestController');
            if (!controller) return false;
            controller.resolveChildren();
            return true;
        })()`));
        await until(() => evaluate(instance.page, `(() => {
            const service = theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'TestService'));
            const controller = service.getControllers().find(value => value.id === 'jestVitestTestController');
            const visit = items => items.flatMap(item => {
                if (item.canResolveChildren && !item.tests.length) item.resolveChildren();
                return [item, ...visit(item.tests)];
            });
            const items = visit(controller.tests);
            if (!items.some(item => item.label === 'IDE test discovery fixture')) return false;
            service.runTests(1, [items.find(item => item.label === 'sample.test.js')]);
            return true;
        })()`));
        const testResult = await until(() => evaluate(instance.page, `(() => {
            const service = theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'TestService'));
            const run = service.getControllers().find(value => value.id === 'jestVitestTestController').testRuns[0];
            if (!run || run.isRunning) return false;
            const visit = items => items.flatMap(item => [item, ...visit(item.tests)]);
            const item = visit(run.items).find(item => item.label === 'IDE test discovery fixture');
            return { state: run.getTestState(item)?.state, output: run.getOutput().map(value => value.output).join('') };
        })()`));
        assert.equal(testResult.state, 3, testResult.output);
        await close(instance);
        assert.match(await readFile(join(directory, 'config/settings.json'), 'utf8'), /"workbench.colorTheme": "light"/);
        assert.match(await readFile(join(directory, 'config/keymaps.json'), 'utf8'), /dope\.projectMind\.open/);

        instance = await launch(directory, port);
        const restored = await evaluate(instance.page, `(async () => {
            const entries = [...theia.container._bindingDictionary._map.entries()];
            const preference = theia.container.get(entries.find(([key]) => key.description === 'PreferenceService')[0]);
            const keymaps = theia.container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.setKeybinding))[0]);
            const activeTheme = theia.container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.loadUserTheme))[0]);
            return { title: document.title, theme: preference.get('workbench.colorTheme'), activeTheme: activeTheme.getCurrentTheme().id,
                font: preference.get('editor.fontSize'), mind: !!document.getElementById('dope-project-mind'),
                binding: keymaps.keybindingRegistry.getKeybindingsByScope(1).some(value => value.command === 'dope.projectMind.open' && value.keybinding === 'ctrl+alt+shift+m'),
                editor: theia.container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.handleNewPreview))[0]).currentEditor?.title.label };
        })()`);
        assert.match(instance.page.url, /#.*workspace$/);
        assert.equal(restored.theme, 'light');
        assert.equal(restored.activeTheme, 'light');
        assert.equal(restored.font, 17);
        assert.equal(restored.mind, true);
        assert.equal(restored.binding, true);
        assert.equal(await until(() => evaluate(instance.page, `[...document.querySelectorAll('.lm-TabBar-tabLabel')].some(node => node.textContent === 'README.md')`)), true);
        assert.equal(await until(() => evaluate(instance.page, `theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'CommandService')).executeCommand('dope-evidence.uppercase', 'again')`), 12000), 'AGAIN');

        await evaluate(instance.page, `localStorage.setItem('theme', 'missing-theme');
            localStorage.setItem('theia:perspective-layouts', '{bad json')`);
        await command(instance.page, 'Target.closeTarget', { targetId: instance.page.id });
        await until(() => instance.child.exitCode !== null || instance.child.signalCode !== null, 15000);
        await rm(workspace, { recursive: true });
        instance = await launch(directory, port);
        const fallback = await evaluate(instance.page, `(() => { const container = theia.container; const entries = [...container._bindingDictionary._map.entries()]; return {
            workspace: container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.doGetDefaultWorkspaceUri))[0]).opened,
            storedLayout: localStorage.getItem('theia:perspective-layouts'),
            mind: !!document.getElementById('dope-project-mind'),
            theme: container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.loadUserTheme))[0]).getCurrentTheme().id
        }; })()`);
        assert.equal(fallback.workspace, false);
        assert.equal(fallback.mind, false);
        assert.equal(fallback.theme, 'light');
        assert.equal(fallback.storedLayout, '{bad json');
        await close(instance);
    } catch (error) {
        throw new Error(`${error}\n${instance?.output ?? ''}`);
    } finally {
        if (instance?.child.exitCode === null && instance.child.signalCode === null) {
            try { await close(instance); } catch { }
        }
        if (instance) try { process.kill(-instance.child.pid, 'SIGTERM'); } catch { }
        await rm(directory, { recursive: true, force: true });
    }
});

test('Project Mind survives process and profile restarts, isolates folders, and requires explicit recovery', { timeout: 300000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dope-mind-restart-'));
    const first = join(directory, 'first');
    const second = join(directory, 'second');
    const profile = join(directory, 'profile-one');
    const otherProfile = join(directory, 'profile-two');
    const port = await availablePort();
    const legacyId = randomUUID();
    const legacy = JSON.stringify({ id: legacyId, schemaVersion: 1, type: 'note', title: 'Legacy note', body: 'Retained source', provenance: 'developer' });
    await mkdir(join(first, '.dope'), { recursive: true });
    await mkdir(second);
    await writeFile(join(first, '.dope', 'note.json'), legacy);
    await writeFile(join(first, 'README.md'), 'Linked file\n');
    let instance;
    try {
        instance = await launch(profile, port, first);
        assert.equal(await evaluate(instance.page, `(() => { const button = [...document.querySelectorAll('button')].find(value => value.textContent.includes('Yes, I trust the authors')); if (!button) return false; button.click(); return true; })()`), true);
        const created = await evaluate(instance.page, `(async () => {
            const key = [...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'ProjectMindService');
            const service = theia.container.get(key);
            const { projectHandle, snapshot: empty } = await service.attach(${JSON.stringify(pathToFileURL(first).toString())});
            if (empty !== undefined) throw Error('legacy Note imported without consent');
            let snapshot = await service.migrate(projectHandle);
            const initial = snapshot.artifacts[0];
            const now = new Date().toISOString();
            const base = (type, title) => ({ schemaVersion: 2, id: crypto.randomUUID(), title,
                createdAt: now, updatedAt: now, provenance: 'developer', archivedAt: null, links: [], type });
            const note = { ...base('note', 'New note'), status: 'active', body: 'Unique searchable content' };
            const idea = { ...base('idea', 'Idea'), status: 'captured', body: 'Try a different approach' };
            const question = { ...base('question', 'Question'), status: 'open', body: 'What changed?' };
            const decision = { ...base('decision', 'Decision'), status: 'proposed', decision: 'Keep the contract',
                context: 'Restart', rationale: 'Durable state', consequences: 'Traceable', alternatives: '', revisitConditions: '' };
            for (const artifact of [note, idea, question, decision]) snapshot = await service.mutate({ projectHandle,
                expectedRevision: snapshot.revision, operation: { type: 'create', artifact } });
            for (const artifact of [note, idea, question, decision]) snapshot = await service.mutate({ projectHandle,
                expectedRevision: snapshot.revision, operation: { type: 'replace', artifact: { ...artifact, title: artifact.title + ' saved', updatedAt: new Date().toISOString() } } });
            for (const operation of [
                { type: 'transition', artifactId: question.id, status: 'answered', answer: 'Persist the snapshot' },
                { type: 'transition', artifactId: decision.id, status: 'accepted' },
                { type: 'link', artifactId: note.id, link: { relation: 'answers', target: { type: 'artifact', id: question.id } } },
                { type: 'link', artifactId: note.id, link: { relation: 'related', target: { type: 'file', path: 'README.md', line: 1 } } },
                { type: 'archive', artifactId: idea.id, archived: true },
                { type: 'archive', artifactId: idea.id, archived: false }
            ]) snapshot = await service.mutate({ projectHandle, expectedRevision: snapshot.revision, operation });
            const replacement = { ...decision, id: crypto.randomUUID(), title: 'Replacement' };
            snapshot = await service.mutate({ projectHandle, expectedRevision: snapshot.revision, operation: { type: 'create', artifact: replacement } });
            snapshot = await service.mutate({ projectHandle, expectedRevision: snapshot.revision, operation: { type: 'transition', artifactId: replacement.id, status: 'accepted' } });
            snapshot = await service.mutate({ projectHandle, expectedRevision: snapshot.revision, operation: { type: 'supersede', oldId: decision.id, replacementId: replacement.id } });
            let stale;
            try { await service.mutate({ projectHandle, expectedRevision: 1, operation: { type: 'archive', artifactId: idea.id, archived: true } }); }
            catch (error) { stale = String(error); }
            return { snapshot, initial, ids: { note: note.id, idea: idea.id, question: question.id, decision: decision.id }, stale };
        })()`);
        assert.match(created.stale, /Stale Project Mind revision/);
        assert.equal(created.snapshot.revision, 18);
        assert.equal(created.snapshot.artifacts.length, 6);
        assert.equal(created.initial.id, legacyId);
        assert.equal(created.initial.createdAt, null);
        assert.equal(created.initial.updatedAt, null);
        assert.equal(created.initial.migration.sourcePath, '.dope/note.json');
        assert.equal(await readFile(join(first, '.dope', 'note.json'), 'utf8'), legacy);
        await close(instance);

        instance = await launch(otherProfile, port, first);
        const reopened = await evaluate(instance.page, `(async () => {
            const service = theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'ProjectMindService'));
            const { projectHandle, snapshot } = await service.attach(${JSON.stringify(pathToFileURL(first).toString())});
            return { snapshot, read: await service.read(projectHandle) };
        })()`);
        assert.deepEqual(reopened.snapshot, created.snapshot);
        assert.deepEqual(reopened.read, created.snapshot);
        assert.deepEqual(queryArtifacts(reopened.read, { text: 'unique searchable' }).map(artifact => artifact.id), [created.ids.note]);
        await close(instance);

        instance = await launch(profile, port, first);
        const search = await evaluate(instance.page, `(async () => {
            await theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'CommandService')).executeCommand('dope.projectMind.open');
            return document.querySelector('#dope-project-mind [role="status"]')?.textContent;
        })()`);
        assert.match(search, /Loading Project Mind|Saved/);
        assert.equal(await until(() => evaluate(instance.page, `(() => {
            const input = document.querySelector('#dope-project-mind input[aria-label="Search Project Mind"]');
            if (!input) return false;
            input.value = 'unique searchable'; input.dispatchEvent(new Event('input', { bubbles: true }));
            return [...document.querySelectorAll('#dope-project-mind li button')].map(button => button.textContent).join('|');
        })()`), 8000), 'New note saved · note · active');
        // Browser-hosted shells may not implement native prompt/confirm. Exercise the real widget dialogs.
        await evaluate(instance.page, `(() => {
            window.prompt = window.confirm = () => { throw Error('Native dialogs unavailable'); };
            document.querySelector('#dope-project-mind li button').click();
        })()`);
        assert.equal(await until(() => evaluate(instance.page, `!![...document.querySelectorAll('#dope-project-mind button')].find(button => button.textContent === 'Link file…')`), 8000), true);
        await evaluate(instance.page, `[...document.querySelectorAll('#dope-project-mind button')].find(button => button.textContent === 'Link file…').click()`);
        assert.equal(await until(() => evaluate(instance.page, `document.querySelector('#theia-dialog-shell input') !== null`), 8000), true);
        await evaluate(instance.page, `(() => {
            const input = document.querySelector('#theia-dialog-shell input');
            input.value = 'dialog-guard.txt'; input.dispatchEvent(new Event('input', { bubbles: true }));
            [...document.querySelectorAll('#theia-dialog-shell button')].find(button => button.textContent === 'Link file').click();
        })()`);
        assert.equal(await until(() => evaluate(instance.page, `document.querySelector('#dope-project-mind')?.textContent.includes('dialog-guard.txt (unresolved file)')`), 8000), true);
        await evaluate(instance.page, `(() => {
            const link = [...document.querySelectorAll('#dope-project-mind button')].find(button => button.textContent.includes('dialog-guard.txt'));
            link.parentElement.querySelectorAll('button')[1].click();
        })()`);
        assert.equal(await until(() => evaluate(instance.page, `!document.querySelector('#dope-project-mind')?.textContent.includes('dialog-guard.txt')`), 8000), true);
        await evaluate(instance.page, `(() => {
            const input = [...document.querySelectorAll('#dope-project-mind textarea')][0];
            input.value = 'discard guard'; input.dispatchEvent(new Event('input', { bubbles: true }));
            [...document.querySelectorAll('#dope-project-mind button')].find(button => button.textContent === 'New idea').click();
        })()`);
        assert.equal(await until(() => evaluate(instance.page, `document.querySelector('#theia-dialog-shell')?.textContent.includes('Unsaved Project Mind draft')`), 8000), true);
        await evaluate(instance.page, `(() => {
            [...document.querySelectorAll('#theia-dialog-shell button')].find(button => button.textContent === 'Discard').click();
        })()`);
        assert.equal(await until(() => evaluate(instance.page, `document.querySelector('#dope-project-mind h3')?.textContent === 'IDEA · captured'`), 8000), true);
        await evaluate(instance.page, `(() => {
            [...document.querySelectorAll('#dope-project-mind button')].find(button => button.textContent === 'Discard / reload').click();
        })()`);
        assert.equal(await until(() => evaluate(instance.page, `document.querySelector('#theia-dialog-shell')?.textContent.includes('Reload Project Mind')`), 8000), true);
        await evaluate(instance.page, `(() => {
            [...document.querySelectorAll('#theia-dialog-shell button')].find(button => button.textContent === 'OK').click();
        })()`);
        assert.equal(await until(() => evaluate(instance.page, `document.querySelector('#dope-project-mind [role="status"]')?.textContent.startsWith('Saved')`), 8000), true);
        await evaluate(instance.page, `(() => {
            const input = document.querySelector('#dope-project-mind input[aria-label="Search Project Mind"]');
            input.value = 'Decision saved'; input.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#dope-project-mind li button').click();
        })()`);
        assert.equal(await until(() => evaluate(instance.page, `!![...document.querySelectorAll('#dope-project-mind button')].find(button => button.textContent === 'Superseded by · Replacement')`), 8000), true);
        await evaluate(instance.page, `[...document.querySelectorAll('#dope-project-mind button')].find(button => button.textContent === 'Superseded by · Replacement').click()`);
        assert.equal(await until(() => evaluate(instance.page, `document.querySelector('#dope-project-mind h3')?.textContent === 'DECISION · accepted'`), 8000), true);
        created.snapshot = JSON.parse(await readFile(join(first, '.dope', 'project-mind.json'), 'utf8'));
        await close(instance);

        instance = await launch(otherProfile, port, second);
        const isolated = await evaluate(instance.page, `(async () => {
            const service = theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'ProjectMindService'));
            const { projectHandle, snapshot: empty } = await service.attach(${JSON.stringify(pathToFileURL(second).toString())});
            const now = new Date().toISOString();
            const snapshot = await service.mutate({ projectHandle, expectedRevision: 0, operation: { type: 'create', artifact: {
                schemaVersion: 2, id: crypto.randomUUID(), type: 'note', title: 'Second project', status: 'active', body: 'Separate',
                createdAt: now, updatedAt: now, provenance: 'developer', archivedAt: null, links: [] } } });
            let wrongHandle;
            try { await service.read('not-this-connection'); } catch (error) { wrongHandle = String(error); }
            return { empty, snapshot, wrongHandle };
        })()`);
        assert.equal(isolated.empty, undefined);
        assert.equal(isolated.snapshot.revision, 1);
        assert.notEqual(isolated.snapshot.projectId, created.snapshot.projectId);
        assert.match(isolated.wrongHandle, /Invalid or detached Project Mind handle/);
        await close(instance);

        const file = join(first, '.dope', 'project-mind.json');
        const committed = await readFile(file, 'utf8');
        const lock = join(first, '.dope', 'project-mind.lock');
        await writeFile(lock, '');
        instance = await launch(otherProfile, port, first);
        const locked = await evaluate(instance.page, `(async () => {
            const service = theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'ProjectMindService'));
            const { projectHandle, snapshot } = await service.attach(${JSON.stringify(pathToFileURL(first).toString())});
            let error;
            try { await service.mutate({ projectHandle, expectedRevision: snapshot.revision, operation:
                { type: 'archive', artifactId: ${JSON.stringify(created.ids.idea)}, archived: true } }); }
            catch (failure) { error = String(failure); }
            return { snapshot, error };
        })()`);
        assert.deepEqual(locked.snapshot, created.snapshot);
        assert.match(locked.error, /Project Mind locked/);
        await close(instance);
        assert.equal(await readFile(file, 'utf8'), committed);
        await rm(lock);

        for (const invalid of ['{', '{"schemaVersion":3,"projectId":"future","revision":12,"artifacts":[]}']) {
            await writeFile(file, invalid);
            instance = await launch(otherProfile, port, first);
            const error = await evaluate(instance.page, `(async () => {
                const service = theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'ProjectMindService'));
                try { await service.attach(${JSON.stringify(pathToFileURL(first).toString())}); }
                catch (failure) { return String(failure); }
                return 'unexpected success';
            })()`);
            assert.match(error, /Corrupt or unsupported Project Mind/);
            await close(instance);
            assert.equal(await readFile(file, 'utf8'), invalid);
        }
        await writeFile(file, committed);
        instance = await launch(otherProfile, port, first);
        const recovered = await evaluate(instance.page, `(async () => {
            const service = theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'ProjectMindService'));
            const { projectHandle, snapshot } = await service.attach(${JSON.stringify(pathToFileURL(first).toString())});
            return { snapshot, read: await service.read(projectHandle) };
        })()`);
        assert.deepEqual(recovered.snapshot, created.snapshot);
        assert.deepEqual(recovered.read, created.snapshot);
        assert.equal(recovered.snapshot.artifacts.find(item => item.id === created.ids.question).answer, 'Persist the snapshot');
        assert.equal(recovered.snapshot.artifacts.find(item => item.id === created.ids.decision).status, 'superseded');
        assert.equal(recovered.snapshot.artifacts.find(item => item.id === created.ids.idea).archivedAt, null);
        assert.equal(recovered.snapshot.artifacts.find(item => item.id === created.ids.note).links.length, 2);
        assert.equal((await readFile(join(second, '.dope', 'project-mind.json'), 'utf8')).includes(created.snapshot.projectId), false);
        await close(instance);
    } catch (error) {
        const ui = instance ? await evaluate(instance.page, `document.querySelector('#dope-project-mind')?.textContent + '\\n' + document.querySelector('#theia-dialog-shell')?.textContent`).catch(() => '') : '';
        throw new Error(`${error}\n${ui}\n${instance?.output ?? ''}`);
    } finally {
        if (instance?.child.exitCode === null && instance.child.signalCode === null) {
            try { await close(instance); } catch { try { process.kill(-instance.child.pid, 'SIGTERM'); } catch { } }
        }
        await rm(directory, { recursive: true, force: true });
    }
});
