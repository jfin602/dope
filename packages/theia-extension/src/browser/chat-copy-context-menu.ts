/** One menu for Dope-owned Chat copy controls. Native menus elsewhere remain untouched. */
export class ChatCopyContextMenu {
    private menu?: HTMLDivElement;
    private anchor?: HTMLElement;
    private readonly dismiss = (event: Event) => {
        if (this.menu && !this.menu.contains(event.target as Node)) this.close(false);
    };

    bind(button: HTMLElement, text: () => string | undefined,
        copy: (value: string) => Promise<void>, feedback: (message: string) => void): void {
        button.addEventListener('contextmenu', event => {
            event.preventDefault(); event.stopPropagation();
            this.open(button, text, copy, feedback);
        });
        button.addEventListener('keydown', event => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                event.preventDefault(); event.stopPropagation();
                this.open(button, text, copy, feedback);
            }
        });
    }

    open(anchor: HTMLElement, text: () => string | undefined,
        copy: (value: string) => Promise<void>, feedback: (message: string) => void): void {
        this.close(false);
        this.anchor = anchor;
        const menu = document.createElement('div');
        menu.className = 'dope-chat-copy-menu'; menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Chat copy options');
        const option = document.createElement('button');
        option.type = 'button'; option.setAttribute('role', 'menuitem');
        option.textContent = 'Copy with Reasoning';
        const available = text();
        option.disabled = available === undefined;
        if (!available) option.title = 'No captured reasoning or provisional activity for this copy scope';
        option.addEventListener('click', () => {
            const value = text();
            this.close();
            if (value === undefined) return;
            void copy(value).then(() => feedback('Copied with reasoning.'),
                () => feedback('Could not copy with reasoning.'));
        });
        menu.append(option);
        if (!available) {
            const reason = document.createElement('div');
            reason.className = 'dope-chat-copy-menu-reason';
            reason.textContent = 'No captured reasoning or provisional activity for this copy scope.';
            menu.append(reason);
        }
        document.body.append(menu);
        const bounds = anchor.getBoundingClientRect();
        menu.style.left = `${Math.max(0, Math.min(bounds.left, window.innerWidth - menu.offsetWidth))}px`;
        menu.style.top = `${Math.max(0, Math.min(bounds.bottom, window.innerHeight - menu.offsetHeight))}px`;
        menu.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); this.close(); }
            else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
                event.preventDefault(); if (!option.disabled) option.focus();
            }
        });
        this.menu = menu;
        document.addEventListener('pointerdown', this.dismiss, true);
        document.addEventListener('focusin', this.dismiss, true);
        if (!option.disabled) option.focus();
        else { menu.tabIndex = -1; menu.focus(); }
    }

    close(restoreFocus = true): void {
        if (!this.menu) return;
        document.removeEventListener('pointerdown', this.dismiss, true);
        document.removeEventListener('focusin', this.dismiss, true);
        this.menu.remove(); this.menu = undefined;
        if (restoreFocus && this.anchor?.isConnected) this.anchor.focus();
        this.anchor = undefined;
    }
}
