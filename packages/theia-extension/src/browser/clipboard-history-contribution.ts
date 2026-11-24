import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { ClipboardHistoryWidget, CLIPBOARD_HISTORY_ID } from './clipboard-history-widget';

@injectable()
export class ClipboardHistoryContribution extends AbstractViewContribution<ClipboardHistoryWidget> {
    constructor() { super({ widgetId: CLIPBOARD_HISTORY_ID, widgetName: 'Clipboard History',
        defaultWidgetOptions: { area: 'bottom', rank: 300 }, toggleCommandId: 'dope.clipboardHistory.open' }); }
}
