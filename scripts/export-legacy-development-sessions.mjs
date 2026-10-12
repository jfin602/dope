#!/usr/bin/env node
// Explicit, offline recovery utility. Keep this independent of retired Session packages.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLANNING_ID = /^[A-Za-z][A-Za-z0-9._-]*$/;
const AGENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function fail(message) { throw new Error(message); }
function shape(value, keys, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail(`Invalid ${name} shape`);
    return value;
}
function number(value, min, name) {
    if (!Number.isSafeInteger(value) || value < min) fail(`Invalid ${name}`);
}
function string(value, max, name, required = false) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim()) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(`Invalid ${name}`);
}
function instant(value, name) {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
        !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(`Invalid ${name}`);
}
function identity(value) {
    const data = shape(value, ['canonicalRoot', 'projectMindId'], 'project identity');
    string(data.canonicalRoot, 4096, 'canonical root', true);
    if (!isAbsolute(data.canonicalRoot) || resolve(data.canonicalRoot) !== data.canonicalRoot ||
        data.canonicalRoot.includes('\\') || data.canonicalRoot.split('/').slice(1).some(part => !part || part === '.' || part === '..'))
        fail('Invalid canonical root');
    if (data.projectMindId !== null &&
        (typeof data.projectMindId !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(data.projectMindId)))
        fail('Invalid Project Mind ID');
    return data;
}
function refId(value, pattern, max, name) {
    if (typeof value !== 'string' || value.length > max || !pattern.test(value) || value === '.' || value === '..')
        fail(`Invalid ${name}`);
}
function reference(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid artifact reference');
    const specs = {
        chat: [['chatId', UUID, 36]],
        'planning-map': [['mapId', PLANNING_ID, 4096]],
        'work-item': [['mapId', PLANNING_ID, 4096], ['workItemId', PLANNING_ID, 4096]],
        'agent-task': [['taskId', AGENT_ID, 120]],
        'agent-run': [['taskId', AGENT_ID, 120], ['runId', AGENT_ID, 120]],
        'agent-sequence': [['sequenceId', AGENT_ID, 120]],
        'project-mind': [['artifactId', UUID, 36], ['artifactType', /^(decision|idea)$/, 8]],
    };
    const fields = specs[value.kind];
    if (!fields) fail('Invalid artifact reference kind');
    shape(value, ['kind', ...fields.map(([key]) => key)], 'artifact reference');
    for (const [key, pattern, max] of fields) refId(value[key], pattern, max, key);
    return JSON.stringify(fields.map(([key]) => value[key].toLowerCase &&
        (key === 'chatId' || key === 'artifactId') ? value[key].toLowerCase() : value[key]).concat(value.kind));
}
function session(value, version, project) {
    const data = shape(value, ['schemaVersion', 'id', 'project', 'revision', 'title', 'objective',
        'createdAt', 'updatedAt', 'status', 'notes', 'nextActions', 'closeout', ...(version === 2 ? ['links'] : [])], 'Session');
    if (data.schemaVersion !== version) fail('Mixed Session schemas');
    refId(data.id, UUID, 36, 'Session ID');
    const sessionProject = identity(data.project);
    if (sessionProject.canonicalRoot !== project.canonicalRoot || sessionProject.projectMindId !== project.projectMindId)
        fail('Foreign Session project identity');
    number(data.revision, 1, 'Session revision');
    string(data.title, 160, 'title', true);
    string(data.objective, 4000, 'objective');
    string(data.notes, 16000, 'notes');
    instant(data.createdAt, 'created timestamp');
    instant(data.updatedAt, 'updated timestamp');
    if (data.updatedAt < data.createdAt) fail('Session updated before creation');
    if (!['active', 'paused', 'closed'].includes(data.status)) fail('Invalid Session status');
    if (!Array.isArray(data.nextActions) || data.nextActions.length > 50) fail('Invalid next actions');
    data.nextActions.forEach(action => string(action, 1000, 'next action', true));
    if (data.closeout !== null) {
        const closeout = shape(data.closeout, ['achieved', 'unresolved', 'deferred', 'closedAt'], 'closeout');
        for (const key of ['achieved', 'unresolved', 'deferred']) string(closeout[key], 4000, key);
        instant(closeout.closedAt, 'closeout timestamp');
        if (closeout.closedAt < data.createdAt || closeout.closedAt > data.updatedAt) fail('Invalid closeout time');
    }
    if ((data.status === 'closed') !== (data.closeout !== null)) fail('Session status and closeout disagree');
    if (version === 2) {
        if (!Array.isArray(data.links) || data.links.length > 100) fail('Invalid Session links');
        const keys = data.links.map(reference);
        if (new Set(keys).size !== keys.length) fail('Duplicate Session reference');
    }
    return version === 2 ? data.links.length : 0;
}
function collection(value, root) {
    const data = shape(value, ['schemaVersion', 'project', 'revision', 'sessions'], 'Session collection');
    if (data.schemaVersion !== 1 && data.schemaVersion !== 2) fail('Unsupported Session schema');
    const project = identity(data.project);
    if (project.canonicalRoot !== root) fail('Session project identity mismatch: copied or moved project');
    number(data.revision, 0, 'collection revision');
    if (!Array.isArray(data.sessions) || data.sessions.length > 10000 ||
        (data.revision === 0 && data.sessions.length)) fail('Invalid Session collection records');
    let links = 0;
    const ids = new Set();
    for (const item of data.sessions) {
        links += session(item, data.schemaVersion, project);
        const id = item.id.toLowerCase();
        if (ids.has(id)) fail('Duplicate Session ID');
        ids.add(id);
    }
    if (links > 10000) fail('Too many Session references');
    return data;
}
async function safeDirectory(path, name) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) fail(`Unsafe ${name} path`);
}
async function readBounded(path, max) {
    const named = await lstat(path);
    if (!named.isFile() || named.isSymbolicLink()) fail('Unsafe input file');
    if (named.size > max) fail('Oversized input file');
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.ino !== named.ino || opened.dev !== named.dev || opened.size > max)
            fail('Unsafe or oversized input file');
        const chunks = [];
        let size = 0;
        while (true) {
            const chunk = Buffer.allocUnsafe(Math.min(65536, max + 1 - size));
            const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
            if (!bytesRead) break;
            size += bytesRead;
            if (size > max) fail('Oversized input file');
            chunks.push(chunk.subarray(0, bytesRead));
        }
        return Buffer.concat(chunks);
    } finally { await handle.close(); }
}
function parseArgs(args) {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        if (!['--project', '--file', '--format'].includes(key) || !args[i + 1] || options[key])
            fail('Usage: node scripts/export-legacy-development-sessions.mjs --project ABSOLUTE_ROOT --format text|json [--file ABSOLUTE_SESSION_FILE]');
        options[key] = args[i + 1];
    }
    if (!options['--project'] || !['text', 'json'].includes(options['--format'])) fail('Explicit project and format required');
    return options;
}
function textExport(data, hash) {
    const lines = [`Legacy Development Sessions (v${data.schemaVersion})`, `Project: ${data.project.canonicalRoot}`,
        `Source SHA-256: ${hash}`, `Collection revision: ${data.revision}`, `Sessions: ${data.sessions.length}`];
    for (const item of data.sessions) {
        lines.push('', `Session ${item.id}`, `Title: ${item.title}`, `Status: ${item.status}`,
            `Created: ${item.createdAt}`, `Updated: ${item.updatedAt}`, `Objective:\n${item.objective}`,
            `Notes:\n${item.notes}`, 'Next actions:', ...item.nextActions.map(action => `  - ${action}`));
        if (item.closeout) lines.push('Closeout:', `  Achieved: ${item.closeout.achieved}`,
            `  Unresolved: ${item.closeout.unresolved}`, `  Deferred: ${item.closeout.deferred}`,
            `  Closed: ${item.closeout.closedAt}`);
        if (item.links) lines.push('Artifact references:', ...item.links.map(ref => `  - ${JSON.stringify(ref)}`));
    }
    return `${lines.join('\n')}\n`;
}

export async function exportLegacySessions(args) {
    const options = parseArgs(args);
    const root = options['--project'];
    if (!isAbsolute(root) || resolve(root) !== root || root.includes('\\') || root.length > 4096)
        fail('Project must be an absolute canonical path without traversal');
    await safeDirectory(root, 'project');
    const directory = join(root, '.dope');
    await safeDirectory(directory, 'Session directory');
    const file = join(directory, 'development-sessions.json');
    if (options['--file'] && options['--file'] !== file) fail('File target must be the project legacy Session file');
    const bytes = await readBounded(file, MAX_BYTES);
    await safeDirectory(root, 'project');
    await safeDirectory(directory, 'Session directory');
    let data;
    try { data = collection(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), root); }
    catch (error) { fail(`Corrupt or unsupported Session collection: ${error.message}`); }
    if (data.project.projectMindId !== null) {
        const mindBytes = await readBounded(join(directory, 'project-mind.json'), MAX_BYTES);
        let mind;
        try { mind = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(mindBytes)); }
        catch { fail('Corrupt Project Mind identity'); }
        if (!mind || mind.projectId !== data.project.projectMindId) fail('Project Mind identity mismatch');
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    const output = options['--format'] === 'json' ? `${JSON.stringify({ sourceSha256: hash, collection: data }, null, 2)}\n` : textExport(data, hash);
    if (Buffer.byteLength(output) > MAX_OUTPUT_BYTES) fail('Export exceeds output limit');
    return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    exportLegacySessions(process.argv.slice(2)).then(output => process.stdout.write(output), error => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}
