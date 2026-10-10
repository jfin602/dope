#!/usr/bin/env node
import { preflightLocalToolSandbox } from '../packages/agent-core/lib/node/local-tool-sandbox.js';

const result = await preflightLocalToolSandbox();
if (result.available) {
    process.stdout.write(`Local tool sandbox available: ${result.evidence}\n`);
} else {
    process.stderr.write(`Local tool sandbox unavailable: ${result.reason}\n`);
    process.exitCode = 1;
}
