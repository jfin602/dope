import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkListOrganization } from '../../packages/theia-extension/lib/browser/work-list-organization.js';
import type { WorkRow } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';

const row = (id: string): WorkRow => ({
    selection: { kind: 'run', id }, title: id, status: 'completed', activity: '',
    updatedAt: '2026-11-24T00:00:00.000Z', running: false
});

test('Work folders and sorting stay project scoped, survive reload, and never remove Work rows', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); } };
    const list = new WorkListOrganization(storage);
    list.attach('/project-a');
    const planning = list.createFolder('', 'Planning');
    assert.equal(planning, 'Planning');
    const nested = list.createFolder(planning!, 'Build');
    assert.equal(nested, 'Planning/Build');
    list.setFolderColor(planning!, 'green');
    list.placeItem('run:b', nested);
    list.placeItem('run:a', nested, 'run:b');
    assert.deepEqual(list.tree([row('b'), row('a'), row('c')]).folders[0].folders[0].rows.map(item => item.selection.id), ['a', 'b']);
    assert.equal(list.color('run:a'), 'blue');
    list.setFolderColor(nested!, 'pink');
    assert.equal(list.color('run:a'), 'pink');
    assert.equal(list.setItemTitle('run:a', '  Review the saved work  '), true);
    assert.equal(list.setItemTitle('run:a', ' '), false);
    const moved = list.placeFolder(nested!, '', 'Planning');
    assert.equal(moved, 'Build');
    assert.equal(list.placement('run:b').folderPath, 'Build');
    const restored = new WorkListOrganization(storage);
    restored.attach('/project-a');
    assert.equal(restored.placement('run:a').folderPath, 'Build');
    assert.equal(restored.color('run:a'), 'pink');
    assert.equal(restored.title('run:a'), 'Review the saved work');
    assert.equal(restored.deleteFolder('Build'), 2);
    assert.deepEqual(restored.tree([row('a'), row('b'), row('c')]).rows.map(item => item.selection.id).sort(), ['a', 'b', 'c']);
    restored.attach('/project-b');
    assert.equal(restored.folders().length, 0);
    assert.equal(restored.title('run:a'), undefined);
    assert.equal(restored.tree([row('a')]).rows.length, 1);
});
