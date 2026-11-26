import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const [root, evidence, backendPid] = process.argv.slice(2);
const journals = join(root, '.dope/agent/direct-journals');
const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const deadline = Date.now() + 180_000;
while (Date.now() < deadline) {
  for (const name of await readdir(journals).catch(() => [])) {
    if (!name.endsWith('.json')) continue;
    const bytes = await readFile(join(journals, name));
    let journal;
    try { journal = JSON.parse(bytes); } catch { continue; }
    if (!journal.changes?.some(change => change.result === 'prepared')) continue;
    const before = {
      at: new Date().toISOString(), backendPid: Number(backendPid), journal: name,
      mainSha256: await digest(join(root, 'src/main.ts')),
      styleSha256: await digest(join(root, 'src/style.css')),
    };
    await writeFile(join(evidence, 'journal-prepared.json'), bytes);
    await writeFile(join(evidence, 'kill-boundary.json'), JSON.stringify(before, null, 2) + '\n');
    process.kill(Number(backendPid), 'SIGKILL');
    process.stdout.write(JSON.stringify(before) + '\n');
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 1));
}
process.stderr.write('No prepared journal observed before deadline\n');
process.exit(2);
