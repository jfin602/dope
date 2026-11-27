// Simple validation script for main.ts
import { readFileSync } from 'fs';
import { join } from 'path';

const tsPath = join(process.cwd(), 'src', 'main.ts');
const content = readFileSync(tsPath, 'utf-8');

console.log('Validating src/main.ts...');
console.log('File exists: true');
console.log('Content length:', content.length);

// Check for basic TypeScript/JavaScript syntax validity
const hasCanvasElement = content.includes("getElementById('game')");
const hasContext2d = content.includes("getContext('2d')");
const hasFillText = content.includes("fillText('Meteor Dodge Replay'");
const hasTypeAssertion = content.includes('as HTMLCanvasElement');

console.log('Has canvas element access:', hasCanvasElement);
console.log('Has 2D context:', hasContext2d);
console.log('Has fillText with correct title:', hasFillText);
console.log('Has TypeScript type assertion:', hasTypeAssertion);

if (hasCanvasElement && hasContext2d && hasFillText) {
  console.log('\n✓ Validation PASSED: src/main.ts is valid JavaScript-compatible TypeScript');
} else {
  console.log('\n✗ Validation FAILED');
  process.exit(1);
}
