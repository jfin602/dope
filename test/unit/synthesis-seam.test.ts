import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../../packages/${path}`, import.meta.url), 'utf8');

test('Software Map owns instructions and retry policy; adapters depend only on runtime requests', () => {
  const runtime = source('contracts/src/model-runtime.ts');
  const strategy = source('software-map/src/synthesis-strategy.ts');
  const reconciliation = source('software-map/src/reconciliation.ts');
  const local = source('theia-extension/src/node/lmstudio-synthesis-provider.ts');
  const gemini = source('theia-extension/src/node/gemini-synthesis-provider.ts');
  assert.match(strategy, /class SoftwareMapSynthesisStrategy/);
  assert.match(runtime, /interface ModelRuntime/);
  assert.match(strategy, /Discover repository-global Systems/);
  assert.match(strategy, /retrySynthesisFailure/);
  assert.doesNotMatch(reconciliation, /provider\.kind\s*===|MAX_GEMINI_ATTEMPTS/);
  for (const adapter of [local, gemini]) {
    assert.doesNotMatch(adapter, /SYSTEM_DISCOVERY_INSTRUCTION|synthesisInstruction|runStage\(/);
    assert.doesNotMatch(adapter, /from ['"]@dope\/software-map/);
    assert.match(adapter, /@dope\/contracts\/lib\/model-runtime/);
    assert.match(adapter, /generateStructured\(/);
  }
  assert.doesNotMatch(gemini, /from ['"]\.\/lmstudio-synthesis-provider/);
});
