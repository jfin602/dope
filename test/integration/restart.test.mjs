import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

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
            if (candidate && await evaluate(candidate, 'document.body.dataset.dopeMode')) return candidate;
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
            await typed('setKeybinding').setKeybinding({ command: 'dope.mode.toggle', keybinding: 'ctrl+alt+shift+m' });
            const editorManager = typed('handleNewPreview');
            await editorManager.open(typed('doGetDefaultWorkspaceUri').workspace.resource.resolve('README.md'));
            await named('CommandService').executeCommand('dope.projectMind.open');
            await container.getAll(entries.find(([key]) => key.description === 'FrontendApplicationContribution')[0]).find(value => value.applyMode).applyMode('PLAN');
            return { theme: preference.get('workbench.colorTheme'), activeTheme: typed('loadUserTheme').getCurrentTheme().id,
                mode: document.body.dataset.dopeMode, editor: editorManager.currentEditor?.title.label,
                mind: !!document.getElementById('dope-project-mind') };
        })()`);
        assert.equal(first.theme, 'light');
        assert.equal(first.activeTheme, 'light');
        assert.equal(first.mode, 'plan');
        assert.match(first.editor ?? '', /README\.md/);
        assert.equal(first.mind, true);
        assert.equal(await until(() => evaluate(instance.page, `theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'CommandService')).executeCommand('dope-evidence.uppercase', 'restart')`), 12000), 'RESTART');
        await close(instance);
        assert.match(await readFile(join(directory, 'config/settings.json'), 'utf8'), /"workbench.colorTheme": "light"/);
        assert.match(await readFile(join(directory, 'config/keymaps.json'), 'utf8'), /dope\.mode\.toggle/);

        instance = await launch(directory, port);
        const restored = await evaluate(instance.page, `(async () => {
            const entries = [...theia.container._bindingDictionary._map.entries()];
            const preference = theia.container.get(entries.find(([key]) => key.description === 'PreferenceService')[0]);
            const keymaps = theia.container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.setKeybinding))[0]);
            const activeTheme = theia.container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.loadUserTheme))[0]);
            return { title: document.title, theme: preference.get('workbench.colorTheme'), activeTheme: activeTheme.getCurrentTheme().id,
                font: preference.get('editor.fontSize'), mode: document.body.dataset.dopeMode, mind: !!document.getElementById('dope-project-mind'),
                binding: keymaps.keybindingRegistry.getKeybindingsByScope(1).some(value => value.command === 'dope.mode.toggle' && value.keybinding === 'ctrl+alt+shift+m'),
                editor: theia.container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.handleNewPreview))[0]).currentEditor?.title.label };
        })()`);
        assert.match(instance.page.url, /#.*workspace$/);
        assert.equal(restored.theme, 'light');
        assert.equal(restored.activeTheme, 'light');
        assert.equal(restored.font, 17);
        assert.equal(restored.mode, 'plan');
        assert.equal(restored.mind, true);
        assert.equal(restored.binding, true);
        assert.match(restored.editor ?? '', /README\.md/);
        assert.equal(await until(() => evaluate(instance.page, `theia.container.get([...theia.container._bindingDictionary._map.keys()].find(key => key.description === 'CommandService')).executeCommand('dope-evidence.uppercase', 'again')`), 12000), 'AGAIN');

        await evaluate(instance.page, `localStorage.setItem('dope.workspaceMode', 'stale-mode'); localStorage.setItem('theme', 'missing-theme');
            localStorage.setItem('theia:perspective-layouts', '{bad json')`);
        await command(instance.page, 'Target.closeTarget', { targetId: instance.page.id });
        await until(() => instance.child.exitCode !== null || instance.child.signalCode !== null, 15000);
        await rm(workspace, { recursive: true });
        instance = await launch(directory, port);
        const fallback = await evaluate(instance.page, `(() => { const container = theia.container; const entries = [...container._bindingDictionary._map.entries()]; return {
            mode: document.body.dataset.dopeMode,
            workspace: container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.doGetDefaultWorkspaceUri))[0]).opened,
            storedLayout: localStorage.getItem('theia:perspective-layouts'),
            mind: !!document.getElementById('dope-project-mind'),
            theme: container.get(entries.find(([, bindings]) => bindings.some(binding => binding.implementationType?.prototype?.loadUserTheme))[0]).getCurrentTheme().id
        }; })()`);
        assert.equal(fallback.mode, 'build');
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
