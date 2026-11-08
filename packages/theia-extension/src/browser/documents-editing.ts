import URI from '@theia/core/lib/common/uri';
import type { Disposable } from '@theia/core/lib/common/disposable';
import type { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import type { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import type { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileSystemProviderCapabilities } from '@theia/filesystem/lib/common/files';
import { readDocumentPreview } from './documents-preview';

type EditingFiles = Pick<FileService, 'resolve' | 'readFile' | 'getReadOnlyMessage' | 'hasCapability'>;
type EditingEditors = Pick<EditorManager, 'open'>;
type SaveModel = { onModelWillSaveModel(listener: () => Promise<void>): Disposable };

/** Keeps Documents navigation separate from the native editor's save and undo authority. */
export class DocumentsEditing {
    private generation = 0;
    private readonly openEditors = new Map<EditorWidget, Disposable[]>();
    private active?: EditorWidget;
    private path?: string;
    private notice?: string;

    constructor(private readonly files: EditingFiles, private readonly editors: EditingEditors,
        private readonly currentProject: () => string | undefined, private readonly changed: () => void) { }

    get dirty(): boolean { return this.active?.saveable.dirty ?? false; }
    get activePath(): string | undefined { return this.path; }
    get message(): string | undefined { return this.notice; }

    externalChange(uri: URI): void {
        if (this.active?.getResourceUri()?.toString() === uri.toString() && this.dirty) {
            this.notice = 'File changed on disk. Save in the editor to review the conflict, or revert your draft there.';
            this.changed();
        }
    }

    /** A project change invalidates in-flight opens and all save guards installed by this viewport. */
    invalidate(): void {
        ++this.generation;
        this.active = undefined;
        this.path = undefined;
        this.notice = undefined;
        this.changed();
    }

    async open(projectUri: string, path: string): Promise<boolean> {
        const generation = this.generation;
        this.notice = undefined;
        this.changed();
        try {
            if (!this.current(projectUri, generation)) throw new Error('Project changed. Select the document again.');
            const root = new URI(projectUri);
            const target = await this.verify(root, path);
            if (!this.current(projectUri, generation)) throw new Error('Project changed. Select the document again.');
            const editor = await this.editors.open(target);
            if (!this.current(projectUri, generation)) {
                if (!editor.saveable.dirty) editor.close();
                throw new Error('Project changed. Select the document again.');
            }
            if (editor.editor.isReadonly) throw new Error('Document is read-only.');
            try { this.installGuard(editor, root, path, projectUri, generation); }
            catch (error) {
                if (!editor.saveable.dirty) editor.close();
                throw error;
            }
            this.active = editor;
            this.path = path;
            this.changed();
            return true;
        } catch (error) {
            this.notice = error instanceof Error ? error.message : 'Unable to open the document editor.';
            this.changed();
            return false;
        }
    }

    private current(projectUri: string, generation: number): boolean {
        return this.generation === generation && this.currentProject() === projectUri;
    }

    private async verify(root: URI, path: string): Promise<URI> {
        // The preview reader checks every path segment, local root, extension, size, text and symlink metadata.
        await readDocumentPreview(this.files, root, path);
        const target = root.resolve(path);
        const stat = await this.files.resolve(target, { resolveMetadata: true });
        if (!stat.isFile || stat.isSymbolicLink || stat.resource.toString() !== target.toString())
            throw new Error('Document unavailable or linked.');
        if (stat.isReadonly || this.files.getReadOnlyMessage(target) ||
            this.files.hasCapability(target, FileSystemProviderCapabilities.Readonly))
            throw new Error('Document is read-only.');
        return target;
    }

    private installGuard(editor: EditorWidget, root: URI, path: string, projectUri: string, generation: number): void {
        const model = editor.editor.document as unknown as Partial<SaveModel>;
        if (typeof model.onModelWillSaveModel !== 'function')
            throw new Error('Native editor save guard unavailable.');
        const previous = this.openEditors.get(editor);
        previous?.forEach(disposable => disposable.dispose());
        const guard = model.onModelWillSaveModel(async () => {
            try {
                if (!this.current(projectUri, generation)) throw new Error('Project changed. Reopen this document from Documents before saving.');
                await this.verify(root, path);
                if (!this.current(projectUri, generation)) throw new Error('Project changed. Reopen this document from Documents before saving.');
            } catch (error) {
                this.notice = error instanceof Error ? error.message : 'Document save denied.';
                this.changed();
                throw error;
            }
        });
        const dirty = editor.saveable.onDirtyChanged(() => {
            if (!editor.saveable.dirty) this.notice = undefined;
            this.changed();
        });
        const closed = editor.onDispose(() => {
            this.openEditors.get(editor)?.forEach(disposable => disposable.dispose());
            this.openEditors.delete(editor);
            if (this.active === editor) { this.active = undefined; this.path = undefined; this.changed(); }
        });
        this.openEditors.set(editor, [guard, dirty, closed]);
    }
}
