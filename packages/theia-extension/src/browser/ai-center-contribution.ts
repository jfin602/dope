import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { CommandContribution, CommandRegistry, Emitter, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { ACCOUNTS_MENU, MANAGE_MENU } from '@theia/core/lib/common/menu';
import { AuthenticationService } from '@theia/core/lib/browser/authentication-service';
import { codicon } from '@theia/core/lib/browser/widgets/widget';
import { AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import { AI_CENTER_ID, AICenterWidget } from './ai-center-widget';
import { connectionWarning } from './ai-center-controller';

export const AI_CENTER_COMMAND = 'dope.aiCenter.open';
export const AI_CENTER_MENU = ['dope_ai_center_menu'];

@injectable()
export class AICenterContribution implements CommandContribution, MenuContribution {
    private readonly badgeChanged = new Emitter<number>();
    private badge = 0;
    private request = 0;
    private replaceBottomMenu?: () => void;

    constructor(@inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(WidgetManager) private readonly widgets: WidgetManager,
        @inject(AIRegistryService) private readonly registry: AIRegistryService,
        @inject(AuthenticationService) private readonly authentication: AuthenticationService) {}

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand({ id: AI_CENTER_COMMAND, label: 'Dope: Open AI Center' }, { execute: () => this.open() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(AI_CENTER_MENU, { commandId: AI_CENTER_COMMAND, label: 'Open AI Center' });
        menus.registerSubmenu(ACCOUNTS_MENU, 'Accounts');
        menus.linkCompoundMenuNode({ newParentPath: MANAGE_MENU, submenuPath: ACCOUNTS_MENU, order: '3_accounts' });
    }

    async onDidInitializeLayout(): Promise<void> {
        const handler = this.shell.leftPanelHandler;
        if (typeof handler.removeBottomMenu !== 'function' || typeof handler.addBottomMenu !== 'function')
            throw new Error('AI Center requires the supported Theia sidebar bottom-menu API');
        const replace = () => {
            handler.removeBottomMenu('accounts-menu');
            handler.addBottomMenu({ id: 'dope-ai-center-menu', iconClass: codicon('sparkle'), title:
                this.badge ? 'AI Center — connection needs attention' : 'AI Center', menuPath: AI_CENTER_MENU,
                order: 1, onDidBadgeChange: this.badgeChanged.event });
        };
        this.replaceBottomMenu = replace;
        replace();
        this.authentication.onDidRegisterAuthenticationProvider(replace);
        this.authentication.onDidUnregisterAuthenticationProvider(replace);
        await this.refresh();
    }

    async refresh(): Promise<void> {
        const request = ++this.request;
        try {
            const state = await this.registry.inventory();
            if (request !== this.request) return;
            const badge = connectionWarning(state) ? 1 : 0;
            if (this.badge !== badge) { this.badge = badge; this.replaceBottomMenu?.(); }
            this.badgeChanged.fire(this.badge);
        } catch {
            if (request !== this.request) return;
            if (this.badge) { this.badge = 0; this.replaceBottomMenu?.(); }
            this.badgeChanged.fire(0);
        }
        this.widgets.tryGetWidget<AICenterWidget>(AI_CENTER_ID)?.refresh();
    }

    async open(): Promise<AICenterWidget> {
        return this.openForChat();
    }

    async openFromChat(chatPanelId: string): Promise<AICenterWidget> {
        return this.openForChat(chatPanelId);
    }

    private async openForChat(chatPanelId?: string): Promise<AICenterWidget> {
        const widget = await this.widgets.getOrCreateWidget<AICenterWidget>(AI_CENTER_ID);
        widget.setReturnToChat(chatPanelId ? () => {
            if (this.widgets.tryGetWidget(chatPanelId)) void this.shell.activateWidget(chatPanelId);
        } : undefined);
        if (!widget.isAttached) await this.shell.addWidget(widget, { area: 'main' });
        await this.shell.activateWidget(widget.id);
        return widget;
    }
}
