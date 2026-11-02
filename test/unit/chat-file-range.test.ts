import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';

test('file pages preserve byte offsets, UTF-8 and source identity behind project policy', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-chat-range-'));
    const root = join(parent, 'one'), other = join(parent, 'two');
    const grounder = new ChatProjectGrounder({} as never);
    const content = `${'row ∑ café\n'.repeat(1800)}TAIL-9247\n`;
    try {
        await mkdir(root); await mkdir(other);
        await writeFile(join(root, 'long.md'), content);
        await writeFile(join(other, 'long.md'), content);
        await mkdir(join(root, '.dope'));
        await writeFile(join(root, '.dope', 'state'), 'private');
        await symlink(join(other, 'long.md'), join(root, 'escape.md'));
        const legacy = await grounder.readFile(root, 'long.md');
        assert.ok(legacy.blocks[0].text.length > 0);
        assert.equal(legacy.blocks[0].text.includes('TAIL-9247'), true);
        let offset = 0, sourceHash: string | undefined;
        const pages: string[] = [];
        do {
            const page = await grounder.readFileRange(root, 'long.md', offset, 1025, sourceHash);
            assert.equal(page.offset, offset);
            assert.equal(page.endOffset, offset + Buffer.byteLength(page.text));
            assert.equal(page.nextOffset, page.truncated ? page.endOffset : null);
            assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 8000);
            pages.push(page.text);
            sourceHash = page.sourceHash;
            offset = page.endOffset;
        } while (offset < Buffer.byteLength(content));
        assert.equal(pages.join(''), content);
        assert.ok(offset > 8192);
        const eof = await grounder.readFileRange(root, 'long.md', offset, 1025, sourceHash);
        assert.equal(eof.text, ''); assert.equal(eof.nextOffset, null);
        assert.equal(eof.truncated, false);
        await assert.rejects(grounder.readFileRange(root, 'long.md', -1));
        await assert.rejects(grounder.readFileRange(root, 'long.md', offset + 1));
        await assert.rejects(grounder.readFileRange(root, 'long.md', 0, 4097));
        const firstMultibyte = Buffer.byteLength('row ');
        await assert.rejects(grounder.readFileRange(root, 'long.md', firstMultibyte + 1, 100, sourceHash));
        await assert.rejects(grounder.readFileRange(root, 'long.md', 9000, 100));
        await assert.rejects(grounder.readFileRange(root, '../two/long.md'));
        await assert.rejects(grounder.readFileRange(root, '.dope/state'));
        await assert.rejects(grounder.readFileRange(root, 'escape.md'));
        await assert.rejects(grounder.readFileRange(other, 'long.md', 1, 100, sourceHash));
        await writeFile(join(root, 'long.md'), content.replace('TAIL-9247', 'TAIL-9999'));
        await assert.rejects(grounder.readFileRange(root, 'long.md', 8192, 100, sourceHash));
        await writeFile(join(root, 'escaped.txt'), '\n'.repeat(9000));
        const escaped = await grounder.readFileRange(root, 'escaped.txt');
        assert.ok(Buffer.byteLength(JSON.stringify(escaped)) <= 8000);
        assert.ok(escaped.nextOffset! > 0);
    } finally { await rm(parent, { recursive: true, force: true }); }
});
