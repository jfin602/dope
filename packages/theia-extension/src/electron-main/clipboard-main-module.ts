import { ContainerModule } from '@theia/core/shared/inversify';
import { RpcConnectionHandler } from '@theia/core/lib/common';
import { ElectronConnectionHandler } from '@theia/core/lib/electron-main/messaging/electron-connection-handler';
import { ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { app, clipboard, nativeImage } from 'electron';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { ClipboardHistory, MAX_IMAGE_BASE64_LENGTH, type ClipboardAdapter,
    type ClipboardContent, type ClipboardHistoryStore, type ClipboardSnapshot } from '../clipboard/clipboard-history';
import { clipboardHistoryPath, type ClipboardHistoryService } from '../clipboard/clipboard-service';

class NativeClipboard implements ClipboardAdapter {
    read(): ClipboardContent | undefined {
        const formats = clipboard.availableFormats('clipboard');
        if (formats.some(format => /image\//i.test(format))) {
            const image = clipboard.readImage('clipboard');
            if (!image.isEmpty()) {
                const size = image.getSize();
                if (size.width * size.height > 4_000_000) return undefined;
                const png = image.toPNG();
                if (png.byteLength * 4 / 3 <= MAX_IMAGE_BASE64_LENGTH)
                    return { kind: 'image', mime: 'image/png', value: png.toString('base64') };
                return undefined;
            }
        }
        const value = clipboard.readText('clipboard');
        return value ? { kind: 'text', value } : undefined;
    }
    write(content: ClipboardContent): void {
        if (content.kind === 'image') clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(content.value, 'base64')));
        else clipboard.writeText(content.value);
    }
}

class FileClipboardStore implements ClipboardHistoryStore {
    private get path(): string { return join(app.getPath('userData'), 'clipboard-history.json'); }
    async read(): Promise<ClipboardSnapshot | undefined> {
        try {
            const data: unknown = JSON.parse(await readFile(this.path, 'utf8'));
            if (!data || typeof data !== 'object' || !Array.isArray((data as ClipboardSnapshot).entries)) return undefined;
            return data as ClipboardSnapshot;
        } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    }
    async write(snapshot: ClipboardSnapshot): Promise<void> {
        const path = this.path;
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        const temporary = `${path}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(snapshot), { mode: 0o600 });
        await rename(temporary, path);
    }
}

export class NativeClipboardHistoryService implements ClipboardHistoryService {
    readonly history = new ClipboardHistory(new NativeClipboard(), new FileClipboardStore());
    revision(): Promise<number> { return Promise.resolve(this.history.revision()); }
    snapshot(): Promise<ClipboardSnapshot> { return Promise.resolve(this.history.snapshot()); }
    restore(id: string): Promise<boolean> { return Promise.resolve(this.history.restore(id)); }
    setPaused(paused: boolean): Promise<void> { this.history.setPaused(paused); return Promise.resolve(); }
    setLimit(limit: number): Promise<void> { this.history.setLimit(limit); return Promise.resolve(); }
    setSkipLikelySecrets(value: boolean): Promise<void> { this.history.setSkipLikelySecrets(value); return Promise.resolve(); }
    pin(id: string, pinned: boolean): Promise<boolean> { return Promise.resolve(this.history.pin(id, pinned)); }
    delete(id: string): Promise<void> { this.history.delete(id); return Promise.resolve(); }
    clear(): Promise<void> { this.history.clear(); return Promise.resolve(); }
}

export default new ContainerModule(bind => {
    bind(NativeClipboardHistoryService).toSelf().inSingletonScope();
    bind(ElectronMainApplicationContribution).toDynamicValue(context => ({
        onStart: () => context.container.get(NativeClipboardHistoryService).history.start(),
        onStop: () => context.container.get(NativeClipboardHistoryService).history.stop()
    })).inSingletonScope();
    bind(ElectronConnectionHandler).toDynamicValue(context => new RpcConnectionHandler(
        clipboardHistoryPath, () => context.container.get(NativeClipboardHistoryService))).inSingletonScope();
});
