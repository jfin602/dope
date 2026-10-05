import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { AGENT_RUN_ID, AgentRunWidget } from './agent-run-widget';

export const AGENT_RUN_COMMAND = 'dope.agentRun.open';
@injectable()
export class AgentRunContribution implements CommandContribution {
    constructor(@inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(WidgetManager) private readonly widgets: WidgetManager) {}
    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand({ id: AGENT_RUN_COMMAND, label: 'Dope: Open Agent Run' }, { execute: () => this.open() });
    }
    async open(): Promise<AgentRunWidget> {
        const widget = await this.widgets.getOrCreateWidget<AgentRunWidget>(AGENT_RUN_ID);
        if (!widget.isAttached) await this.shell.addWidget(widget, { area: 'main' });
        await this.shell.activateWidget(widget.id);
        return widget;
    }
}
