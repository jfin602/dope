import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { WorkspaceMode, WorkspaceModeService, parseWorkspaceMode } from '../../packages/contracts/src/workspace-mode.ts';

const root = new URL('../../', import.meta.url).pathname;

test('WorkspaceMode transitions are Dope-owned and replay only changes', () => {
  const mode = new WorkspaceModeService();
  const seen: WorkspaceMode[] = [];
  const dispose = mode.onChange(value => seen.push(value));
  assert.equal(mode.current, WorkspaceMode.BUILD);
  mode.set(WorkspaceMode.PLAN);
  mode.set(WorkspaceMode.PLAN);
  dispose();
  mode.set(WorkspaceMode.BUILD);
  assert.deepEqual(seen, [WorkspaceMode.PLAN]);
  assert.equal(parseWorkspaceMode('PLAN'), WorkspaceMode.PLAN);
  assert.equal(parseWorkspaceMode('broken'), WorkspaceMode.BUILD);
});

test('shared customization bindings and restore hook remain wired', () => {
  const contract = readFileSync(join(root, 'packages/contracts/src/workspace-mode.ts'), 'utf8');
  const module = readFileSync(join(root, 'packages/theia-extension/src/browser/frontend-module.ts'), 'utf8');
  const workbench = readFileSync(join(root, 'packages/theia-extension/src/browser/dope-workbench.ts'), 'utf8');
  assert.doesNotMatch(contract, /@theia|Widget|Perspective|layout JSON/);
  assert.match(module, /bindViewContribution\(bind, ProjectMindView\)/);
  assert.match(module, /bindViewContribution\(bind, PlanningView\)/);
  assert.match(module, /rebind\(WindowTitleService\)/);
  assert.match(workbench, /onDidInitializeLayout/);
  assert.match(workbench, /parseWorkspaceMode\(storedMode\)/);
  assert.match(workbench, /explorer\.removeWidget\(openEditors\)/);
});
