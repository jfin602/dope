import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('./package.json');
const lock = read('./package-lock.json');
const installed = read('./node_modules/@earendil-works/pi-coding-agent/package.json');
const version = '1.4.0';
const pi = lock.packages['node_modules/@earendil-works/pi-coding-agent'];
if (manifest.dependencies['@earendil-works/pi-coding-agent'] !== version ||
    lock.packages[''].dependencies['@earendil-works/pi-coding-agent'] !== version ||
    pi?.version !== version || installed.version !== version || pi.license !== 'MIT' ||
    pi.integrity !== 'sha512-Z41LpZ3yYHSC/UUps6Mr39UMFPwH8elhJBG9DY1P7kuzsE5qSK/6eMj2EHzO5evJRQWLbKSqUMw+4nCNtIyiQg==')
  throw new Error('Pi runtime package identity or integrity mismatch');

const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'BlueOak-1.0.0', '0BSD', 'Unlicense']);
const packages = Object.entries(lock.packages).filter(([path]) => path);
for (const [path, entry] of packages) {
  if (!entry.version || !entry.integrity?.startsWith('sha512-') || !allowed.has(entry.license))
    throw new Error(`Unreviewed Pi dependency: ${path}`);
}
console.log(`Pi ${version}: ${packages.length} integrity-locked packages; licenses reviewed`);
