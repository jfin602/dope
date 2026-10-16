// Extract the synthetic qualification Chats without changing product or fixture state.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = 'docs/tasks/c10-green-recovery/qualification/r5-context/group-2/evidence';
const roots = [
  ['saved-chat', '/tmp/dope-r5-group2-q4'],
  ['repeat-a', '/tmp/dope-r5-group2-repeat-a'],
  ['repeat-b', '/tmp/dope-r5-group2-repeat-b'],
];
const ledger = [];
const baseline = '715066e436dc1767463ce45ac6edf95588f960b5';
const firstRepairBundle = '1630a366bbc9554893e05e1de6c12b0275e5a53a';
const finalBundle = '968780c23b4e2d9be78f02bb03d7b6b338819baa';
const savedGrades = [
  'incorrect-missing-facts', 'incorrect-missing-facts', 'incorrect-refused-edit',
  'incorrect-false-unlinked', 'correct-approved-edit', 'incorrect-false-read-only',
  'incorrect-placeholder', 'incorrect-placeholder-stale-bundle', 'correct-approved-edit',
  'correct-fresh-answer', 'incorrect-placeholder-stale-bundle',
  'incorrect-placeholder-stale-bundle', 'cancelled-browser-tab-crash',
  'incomplete-owner-revision',
];
const snapshots = {
  initial: { revision: 3, ownerSha256: '5a8a22cc6b6ea7c35129e210773f3619eb3bbcca5dc8fcf5f9bafe71dfccc713',
    markdownSha256: 'fa5813d4c85cb2a173073a4e5b7c3ac73294dd2d01f00e5e6c9a058f1345a8f4' },
  firstEdit: { revision: 6, ownerSha256: 'd8b19d06cc3f148d2d449b9c15ada673b5bb622ea630274982e784bd71bc69ee',
    markdownSha256: 'c3b5c23f0198b1e29add485a28f2867598c2e179d53d785193d13276ec2aeed0' },
  secondEdit: { revision: 9, ownerSha256: 'fe255ea831dbfc8e1328564cd864db479102d402744e52ec0937fe8bacc36caa',
    markdownSha256: '9bace3b3b5eca76bd09650607b21ea945b799c4f3e9c07ffdd30c125bce926a0' },
  repeatA: { revision: 3, ownerSha256: '452368540b5a5faed314b8cc7a3a3441321e0cb02dc98eadcf967a6d378cddba',
    markdownSha256: 'fa5813d4c85cb2a173073a4e5b7c3ac73294dd2d01f00e5e6c9a058f1345a8f4' },
  repeatB: { revision: 3, ownerSha256: 'd29a73ae9fb7f5e5a1c0dd4c55545975d0aa4ae957080e86e07a17f31087c479',
    markdownSha256: 'fa5813d4c85cb2a173073a4e5b7c3ac73294dd2d01f00e5e6c9a058f1345a8f4' },
};
for (const [fixture, root] of roots) {
  let names;
  try { names = (await readdir(join(root, '.dope/chats/folders'))).filter(x => x.endsWith('.json')); }
  catch { continue; }
  for (const name of names) {
    const chat = JSON.parse(await readFile(join(root, '.dope/chats/folders', name), 'utf8'));
    for (let i = 0; i < chat.messages.length; i += 2) {
      const user = chat.messages[i];
      const assistant = chat.messages[i + 1];
      if (user?.role !== 'user' || assistant?.role !== 'assistant') continue;
      let structured;
      try { structured = JSON.parse(assistant.content); }
      catch { structured = null; }
      const started = assistant.execution?.startedAt;
      const finished = assistant.execution?.finishedAt;
      const turn = i / 2 + 1;
      const runtimeProductSha = fixture === 'saved-chat' ?
        turn <= 6 ? baseline : turn <= 12 ? firstRepairBundle : finalBundle :
        turn <= 3 ? firstRepairBundle : finalBundle;
      const grade = fixture === 'saved-chat' ? savedGrades[turn - 1] : 'correct';
      const before = fixture === 'saved-chat' ?
        turn <= 5 ? snapshots.initial : turn <= 9 ? snapshots.firstEdit : snapshots.secondEdit :
        fixture === 'repeat-a' ? snapshots.repeatA : snapshots.repeatB;
      const after = fixture === 'saved-chat' && turn === 5 ? snapshots.firstEdit :
        fixture === 'saved-chat' && turn === 9 ? snapshots.secondEdit : before;
      const refs = user.contextRefs ?? assistant.planningActivity?.refs ?? [];
      ledger.push({ fixture, root, chatId: chat.id, chatRevision: chat.revision,
        runtimeProductSha, grade, ownerBefore: before, ownerAfter: after,
        sourceDecisionRevisionInContext: refs.some(ref => ref.kind === 'file' &&
          ['docs/planning-brief.md', 'docs/current-decision.md'].includes(ref.id)) ? 4 : null,
        measuredProviderRequestCount: fixture === 'saved-chat' && turn <= 2 ? null : 1,
        measuredProviderHttpStatus: fixture === 'saved-chat' && turn <= 2 ? null : 200,
        turn, userMessageId: user.id, assistantMessageId: assistant.id,
        prompt: user.content, response: assistant.content, structured,
        structuredJsonParse: structured !== null,
        strictEnvelopeAccepted: assistant.execution?.status === 'complete' && !!assistant.planningActivity,
        approvalState: assistant.planningActivity?.status === 'applied' ? 'explicitly-approved' :
          assistant.planningActivity?.status === 'denied' ? 'explicitly-rejected' : 'not-applicable',
        execution: assistant.execution,
        totalMs: started && finished ? Date.parse(finished) - Date.parse(started) : null,
        planningActivity: assistant.planningActivity ?? null,
        refs });
    }
  }
}
await writeFile(join(base, 'attempt-ledger.json'), JSON.stringify(ledger, null, 2) + '\n');
console.log(JSON.stringify({ attempts: ledger.length, byFixture: Object.fromEntries(roots.map(([name]) => [name, ledger.filter(x => x.fixture === name).length])) }));
