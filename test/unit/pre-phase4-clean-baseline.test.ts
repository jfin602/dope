import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const removed = /packages[\\/]planning\b|@dope\/planning\b|\b(?:PlanningService|PlanningClient|planningServicePath|PlanningStore|PlanningBackend|PlanningView|PlanningWidget|PLANNING_ID)\b|WorkspaceMode\s*\.\s*PLAN\b|dope\.workspaceMode\b|dope\.mode\.|planning\.json\b/;

// Current source/configuration only: historical docs, tests and generated bundles are not product authority.
function files(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'lib', 'src-gen', 'build'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(?:ts|js|mjs|cjs|json|css|ya?ml)$/.test(path) ? [path] : [];
  });
}

test('current production and package wiring stays free of Phase 3 Planning instruments', () => {
  for (const path of ['packages/planning', 'packages/contracts/src/planning.ts', 'packages/contracts/src/planning-service.ts', 'packages/contracts/src/workspace-mode.ts']) {
    assert.equal(existsSync(join(root, path)), false, `${path} must remain removed`);
  }
  for (const path of ['package.json', 'tsconfig.json', 'yarn.lock', ...files('apps'), ...files('packages'), ...files('scripts')]) {
    assert.doesNotMatch(path, /(?:^|[\\/])planning(?:[-.][^\\/]*)?\.(?:ts|js|mjs|cjs|json)$/, `${path}: removed module`);
    const source = readFileSync(join(root, path), 'utf8');
    assert.doesNotMatch(source, removed, `${path}: removed Planning wiring`);
    if (path.startsWith('packages/contracts/')) {
      assert.doesNotMatch(source, /\b(?:interface|type|class)\s+(?:Plan|PlanStep|Task|Planning\w*)\b/, `${path}: removed DTO`);
    }
  }
  assert.equal(execFileSync('git', ['ls-files', '--', '.dope/planning.json'], { cwd: root, encoding: 'utf8' }).trim(), '', 'repository Planning state must remain untracked');
});
