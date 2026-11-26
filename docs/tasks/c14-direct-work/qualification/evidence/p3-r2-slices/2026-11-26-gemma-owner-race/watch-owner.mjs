import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/tmp/dope-p3-r2-gemma-race-YotJda/fixture';
const runs = `${root}/.dope/agent/runs`;
const prior = new Set(existsSync(runs) ? readdirSync(runs) : []);
const target = `${root}/src/main.ts`;
const sha = value => createHash('sha256').update(value).digest('hex');
const started = Date.now();
while (Date.now() - started < 120000) {
  for (const id of (existsSync(runs) ? readdirSync(runs) : []).filter(id => !prior.has(id))) {
    let transcript = '';
    try { transcript = readFileSync(`${runs}/${id}/transcript.jsonl`, 'utf8'); } catch { continue; }
    if (!transcript.split('\n').some(line => line.includes('"toolName":"read_file"') && line.includes('"phase":"completed"'))) continue;
    const before = readFileSync(target);
    const after = Buffer.from("export const headline = 'Owner Copper';\n");
    writeFileSync(target, after);
    writeFileSync('owner-boundary.json', JSON.stringify({runId:id, at:new Date().toISOString(), beforeSha:sha(before), afterSha:sha(after), transcript}, null, 2));
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 20));
}
writeFileSync('owner-boundary.json', JSON.stringify({timedOut:true, at:new Date().toISOString()}, null, 2));
process.exit(1);
