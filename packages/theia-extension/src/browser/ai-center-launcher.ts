import * as React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandRegistry } from '@theia/core/lib/common';
import { SidebarBottomMenuWidget } from '@theia/core/lib/browser/shell/sidebar-bottom-menu-widget';
import { SidebarMenuItem } from '@theia/core/lib/browser/shell/sidebar-menu-widget';
import { AI_CENTER_COMMAND } from './ai-center-contribution';

@injectable()
export class AICenterBottomMenuWidget extends SidebarBottomMenuWidget {
    constructor(@inject(CommandRegistry) private readonly commands: CommandRegistry) { super(); }

    protected override renderItem(item: SidebarMenuItem): React.ReactNode {
        if (item.menu.id !== 'dope-ai-center-menu') return super.renderItem(item);
        return React.createElement('button', {
            key: item.menu.id, type: 'button', className: 'theia-sidebar-menu-item dope-ai-launcher',
            title: item.menu.title, 'aria-label': item.menu.title,
            onClick: () => { void this.commands.executeCommand(AI_CENTER_COMMAND); }
        }, React.createElement('i', { className: item.menu.iconClass, 'aria-hidden': true }),
        item.badge ? React.createElement('span', { className: 'dope-ai-launcher-warning', 'aria-hidden': true }, '!') : null);
    }
}
