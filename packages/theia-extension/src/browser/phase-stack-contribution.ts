import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { PHASE_STACK_ID, PhaseStackWidget } from './phase-stack-widget';

export const PHASE_STACK_COMMAND = 'dope.phaseStack.open';
@injectable()
export class PhaseStackContribution implements CommandContribution {
    constructor(@inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(WidgetManager) private readonly widgets: WidgetManager) {}
    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand({ id: PHASE_STACK_COMMAND, label: 'Dope: Open Phase Stack' },
            { execute: () => this.open() });
    }
    async open(): Promise<PhaseStackWidget> {
        const widget = await this.widgets.getOrCreateWidget<PhaseStackWidget>(PHASE_STACK_ID);
        if (!widget.isAttached) await this.shell.addWidget(widget, { area: 'main' });
        await this.shell.activateWidget(widget.id);
        return widget;
    }
}
