import { injectable } from '@theia/core/shared/inversify';
import type { FrontendApplicationContribution } from '@theia/core/lib/browser';

/** One tooltip presenter for native title attributes and Dope-authored previews. */
@injectable()
export class DopeTooltipContribution implements FrontendApplicationContribution {
    private target?: Element;
    private tooltip?: HTMLElement;
    private originalTitle: string | null = null;
    private originalDescription: string | null = null;
    private observer?: MutationObserver;
    private pending?: ReturnType<typeof setTimeout>;

    onStart(): void {
        document.addEventListener('pointerover', this.pointerOver, true);
        document.addEventListener('pointerout', this.pointerOut, true);
        document.addEventListener('focusin', this.focusIn, true);
        document.addEventListener('focusout', this.focusOut, true);
        document.addEventListener('click', this.hide, true);
        document.addEventListener('keydown', this.keyDown, true);
        window.addEventListener('scroll', this.hide, true);
        window.addEventListener('resize', this.hide);
    }

    private candidate(node: EventTarget | null): Element | undefined {
        if (!(node instanceof Element)) return undefined;
        return node.closest('[title], [data-dope-tooltip]') ?? undefined;
    }

    private readonly pointerOver = (event: PointerEvent): void => {
        const target = this.candidate(event.target);
        if (!target || target === this.target) return;
        this.hide();
        // Suppress the browser tooltip immediately, then show the styled one after a short pause.
        this.target = target;
        this.originalTitle = target.getAttribute('title');
        this.originalDescription = target.getAttribute('aria-describedby');
        if (this.originalTitle !== null) target.removeAttribute('title');
        this.observeTitle();
        this.pending = setTimeout(() => { this.pending = undefined; this.show(); }, 280);
    };

    private readonly pointerOut = (event: PointerEvent): void => {
        if (!this.target || !(event.target instanceof Node) || !this.target.contains(event.target)) return;
        if (event.relatedTarget instanceof Node && this.target.contains(event.relatedTarget)) return;
        this.hide();
    };

    private readonly focusIn = (event: FocusEvent): void => {
        const target = this.candidate(event.target);
        if (!target) return;
        if (target === this.target) {
            if (this.pending) { clearTimeout(this.pending); this.pending = undefined; this.show(); }
            return;
        }
        this.hide();
        this.target = target;
        this.originalTitle = target.getAttribute('title');
        this.originalDescription = target.getAttribute('aria-describedby');
        if (this.originalTitle !== null) target.removeAttribute('title');
        this.observeTitle();
        this.show();
    };

    private readonly focusOut = (event: FocusEvent): void => {
        if (this.target && event.target instanceof Node && this.target.contains(event.target)) this.hide();
    };

    private readonly keyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') this.hide();
    };

    private observeTitle(): void {
        if (!this.target) return;
        this.observer = new MutationObserver(() => {
            if (!this.target) return;
            const nextTitle = this.target.getAttribute('title');
            if (nextTitle !== null) {
                this.originalTitle = nextTitle;
                this.target.removeAttribute('title');
            }
            if (this.tooltip) this.tooltip.textContent = this.message();
        });
        this.observer.observe(this.target, { attributes: true, attributeFilter: ['title', 'data-dope-tooltip'] });
    }

    private message(): string {
        return (this.target?.getAttribute('data-dope-tooltip') || this.originalTitle || '').trim();
    }

    private show(): void {
        if (!this.target || !this.target.isConnected || !this.message()) { this.hide(); return; }
        const tooltip = document.createElement('div');
        tooltip.className = 'dope-tooltip';
        tooltip.id = 'dope-active-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = this.message();
        document.body.append(tooltip);
        this.tooltip = tooltip;
        const bounds = this.target.getBoundingClientRect();
        const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
        tooltip.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8))}px`;
        tooltip.style.top = `${bounds.bottom + height + 8 <= window.innerHeight ? bounds.bottom + 6 :
            Math.max(8, bounds.top - height - 6)}px`;
        this.target.setAttribute('aria-describedby', [this.originalDescription, tooltip.id].filter(Boolean).join(' '));
    }

    private readonly hide = (): void => {
        if (this.pending) clearTimeout(this.pending);
        this.pending = undefined;
        this.observer?.disconnect();
        this.observer = undefined;
        this.tooltip?.remove();
        this.tooltip = undefined;
        if (this.target) {
            if (this.originalDescription === null) this.target.removeAttribute('aria-describedby');
            else this.target.setAttribute('aria-describedby', this.originalDescription);
            if (this.originalTitle !== null && !this.target.hasAttribute('title'))
                this.target.setAttribute('title', this.originalTitle);
        }
        this.target = undefined;
        this.originalTitle = null;
        this.originalDescription = null;
    };
}
