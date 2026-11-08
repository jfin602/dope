import assert from 'node:assert/strict';
import test from 'node:test';
import { BinaryBuffer } from '@theia/core/lib/common/buffer.js';
import { URI } from '@theia/core/lib/common/uri.js';
import { documentFormat, readDocumentPreview, safeDocumentLink, DOCUMENT_PREVIEW_MAX_BYTES } from
    '../../packages/theia-extension/lib/browser/documents-preview.js';
import { renderUntrustedMessageHtml } from
    '../../packages/theia-extension/lib/browser/untrusted-message-markdown.js';

const root = new URI('file:///project');
function reader(value: Uint8Array, options: { linked?: boolean; size?: number; denied?: boolean } = {}) {
    const calls: string[] = [];
    return { calls, files: {
        async resolve(uri: URI) {
            calls.push(`resolve:${uri.toString()}`);
            if (options.denied) throw new Error('access denied');
            const path = uri.toString();
            const isFile = path.endsWith('.md') || path.endsWith('.txt');
            return { resource: uri, isFile, isDirectory: !isFile, isSymbolicLink: !!options.linked && path.endsWith('/docs'),
                size: isFile ? options.size ?? value.length : 0 };
        },
        async readFile(uri: URI, readOptions: { limits?: { size?: number } }) {
            calls.push(`read:${uri.toString()}`);
            assert.equal(readOptions.limits?.size, DOCUMENT_PREVIEW_MAX_BYTES + 1);
            return { value: BinaryBuffer.wrap(value) };
        }
    }};
}

test('Markdown formatting reuses the untrusted renderer, including tables and code copy markup', () => {
    const html = renderUntrustedMessageHtml('# Title\n\n- one\n- two\n\n| A | B |\n|---|---|\n| x | y |\n\n```ts\n  x();\n```');
    assert.match(html, /<h1>Title<\/h1>/);
    assert.match(html, /<ul>/);
    assert.match(html, /<table>/);
    assert.match(html, /dope-message-code/);
    assert.match(html, /<code>  x\(\);\n<\/code>/);
});

test('hostile HTML and images cannot create active preview elements', () => {
    const html = renderUntrustedMessageHtml('<script>alert(1)</script>\n\n<img src="https://evil.test/pixel">\n\n![spy](https://evil.test/pixel)\n\n[bad](javascript:alert(1))');
    assert.doesNotMatch(html, /<(?:script|img)\b|<a\b/i);
    assert.match(html, /Image omitted: spy/);
    assert.match(html, /&lt;script&gt;/);
    for (const href of ['javascript:alert(1)', 'file:///etc/passwd', 'vscode://file/x', '../local.md',
        '/internal', 'https://user:pass@example.test/']) assert.equal(safeDocumentLink(href), false, href);
    for (const href of ['https://example.test/', 'http://example.test/', 'mailto:a@example.test'])
        assert.equal(safeDocumentLink(href), true, href);
});

test('text and source retain exact whitespace and line endings on the read boundary', async () => {
    const original = '  first\r\n\tsecond  \n\n<raw & text>\n';
    const source = reader(new TextEncoder().encode(original));
    assert.equal(documentFormat('docs/notes.txt'), 'txt');
    assert.equal(documentFormat('docs/guide.md'), 'md');
    assert.equal(await readDocumentPreview(source.files, root, 'docs/notes.txt'), original);
    assert.equal(await readDocumentPreview(reader(new TextEncoder().encode(`\uFEFF${original}`)).files,
        root, 'docs/notes.txt'), `\uFEFF${original}`);
    assert.deepEqual(source.calls, ['resolve:file:///project', 'resolve:file:///project/docs',
        'resolve:file:///project/docs/notes.txt', 'read:file:///project/docs/notes.txt']);
    const implementation = await import('node:fs/promises').then(fs => fs.readFile(
        'packages/theia-extension/src/browser/documents-preview.ts', 'utf8'));
    assert.match(implementation, /pre\.textContent = text/);
    assert.match(implementation, /renderUntrustedMessageMarkdown/);
    assert.match(implementation, /safeDocumentLink\(link\.getAttribute/);
});

test('unsafe, linked, oversized, binary and unreadable files fail before display', async () => {
    const content = new TextEncoder().encode('hello');
    for (const path of ['../secret.md', '.dope/private.md', 'docs/run.ts', 'docs/evil\\name.md'])
        await assert.rejects(readDocumentPreview(reader(content).files, root, path), /Unsafe/);
    const linked = reader(content, { linked: true });
    await assert.rejects(readDocumentPreview(linked.files, root, 'docs/a.md'), /linked/);
    assert.equal(linked.calls.some(call => call.startsWith('read:')), false);
    const large = reader(content, { size: DOCUMENT_PREVIEW_MAX_BYTES + 1 });
    await assert.rejects(readDocumentPreview(large.files, root, 'a.md'), /too large/);
    assert.equal(large.calls.some(call => call.startsWith('read:')), false);
    await assert.rejects(readDocumentPreview(reader(new Uint8Array([0xff])).files, root, 'a.md'), /UTF-8/);
    await assert.rejects(readDocumentPreview(reader(new Uint8Array([0])).files, root, 'a.txt'), /binary/);
    await assert.rejects(readDocumentPreview(reader(content, { denied: true }).files, root, 'a.md'), /access denied/);
});
