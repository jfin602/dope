import { SelectionService } from '@theia/core/lib/common';
import { injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { Widget, Message } from '@theia/core/lib/browser';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { EditorWidgetFactory } from '@theia/editor/lib/browser/editor-widget-factory';
import type { TextEditor } from '@theia/editor/lib/browser/editor';
import { renderDocumentPreview } from './documents-preview';
import { nativeDocumentFormat, nativeDocumentModes, type NativeDocumentFormat, type NativeDocumentMode } from './native-doc-editor-modes';

const FOOTER_HEIGHT = 38;
const MAX_FORMATTED_CHARACTERS = 1_000_000;

/** The normal Theia file editor remains the save, undo and source owner. */
export class NativeDocumentEditorWidget extends EditorWidget {
    private readonly footer = document.createElement('nav');
    private readonly formatted = document.createElement('div');
    private mode: NativeDocumentMode = 'source';

    constructor(editor: TextEditor, selection: SelectionService, readonly format: NativeDocumentFormat) {
        super(editor, selection);
        this.addClass('dope-native-document-editor');
        this.footer.className = 'dope-native-document-modes';
        this.footer.setAttribute('aria-label', 'Document view mode');
        this.formatted.className = 'dope-native-document-formatted';
        this.formatted.setAttribute('aria-label', 'Formatted Markdown (read-only)');
        this.formatted.tabIndex = 0;
        this.formatted.hidden = true;
        this.node.append(this.formatted, this.footer);
        this.renderControls();
        this.toDispose.push(this.editor.onDocumentContentChanged(() => {
            if (this.mode === 'formatted') this.renderFormatted();
        }));
    }

    private renderControls(): void {
        this.footer.replaceChildren();
        for (const mode of ['source', 'diff', ...(this.format === 'md' ? ['formatted'] : [])] as NativeDocumentMode[]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = mode[0].toUpperCase() + mode.slice(1);
            button.setAttribute('aria-pressed', String(this.mode === mode));
            button.disabled = !nativeDocumentModes(this.format, false).includes(mode);
            if (mode === 'diff') button.title = 'No comparison source is available for this file';
            button.addEventListener('click', () => this.selectMode(mode));
            this.footer.append(button);
        }
    }

    private selectMode(mode: NativeDocumentMode): void {
        if (!nativeDocumentModes(this.format, false).includes(mode)) return;
        if (this.mode === mode) return;
        this.mode = mode;
        this.formatted.hidden = mode !== 'formatted';
        this.node.classList.toggle('dope-native-document-show-formatted', mode === 'formatted');
        if (mode === 'formatted') {
            this.renderFormatted();
            this.formatted.focus();
        } else {
            this.editor.focus();
            this.editor.refresh();
        }
        this.renderControls();
    }

    private renderFormatted(): void {
        if (this.format !== 'md') return;
        const text = this.editor.document.getText();
        if (text.length > MAX_FORMATTED_CHARACTERS) {
            this.formatted.textContent = 'Document is too large to format.';
            return;
        }
        // Reuse the existing untrusted Markdown boundary. Links are inert in this
        // preview: document content never triggers navigation or resource loads.
        const documentView = renderDocumentPreview('md', text);
        for (const link of documentView.querySelectorAll('a[href]')) link.removeAttribute('href');
        this.formatted.replaceChildren(documentView);
    }

    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        if (this.mode === 'formatted') this.formatted.focus();
    }

    protected override onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.editor.setSize({ width: this.node.clientWidth, height: Math.max(0, this.node.clientHeight - FOOTER_HEIGHT) });
    }

    protected override onResize(msg: Widget.ResizeMessage): void {
        const width = msg.width >= 0 ? msg.width : this.node.clientWidth;
        const height = msg.height >= 0 ? msg.height : this.node.clientHeight;
        this.editor.setSize({ width, height: Math.max(0, height - FOOTER_HEIGHT) });
    }
}

/** Theia's public editor factory hook keeps every non-document widget unchanged. */
@injectable()
export class NativeDocumentEditorWidgetFactory extends EditorWidgetFactory {
    protected override async constructEditor(uri: URI): Promise<EditorWidget> {
        const format = nativeDocumentFormat(uri.scheme, uri.path.toString());
        if (!format) return super.constructEditor(uri);
        return new NativeDocumentEditorWidget(await this.editorProvider(uri), this.selectionService, format);
    }
}
