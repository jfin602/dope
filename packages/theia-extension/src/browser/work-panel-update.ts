/** Keep the visible Work transcript mounted when a refresh only changes its entries. */
export function reuseWorkTranscript(currentShell: HTMLElement, freshShell: HTMLElement): boolean {
    const current = currentShell.querySelector<HTMLElement>('.dope-work-transcript');
    const fresh = freshShell.querySelector<HTMLElement>('.dope-work-transcript');
    if (!current || !fresh) return false;
    const currentDetails = currentShell.querySelector<HTMLElement>('.dope-work-run-details');
    const freshDetails = freshShell.querySelector<HTMLElement>('.dope-work-run-details');
    if (!!currentDetails !== !!freshDetails) return false;
    const shellMarkup = (shell: HTMLElement): string => {
        const copy = shell.cloneNode(true) as HTMLElement;
        copy.querySelector('.dope-work-transcript')?.remove();
        copy.querySelector('.dope-work-run-details')?.remove();
        copy.querySelectorAll('.dope-elapsed-time').forEach(clock => { clock.textContent = ''; });
        return copy.innerHTML;
    };
    if (shellMarkup(currentShell) !== shellMarkup(freshShell)) return false;
    patchWorkTranscript(current, fresh);
    if (currentDetails && freshDetails) patchWorkTranscript(currentDetails, freshDetails);
    return true;
}

function patchWorkTranscript(current: Node, fresh: Node): void {
    if (current.nodeType !== fresh.nodeType || current.nodeName !== fresh.nodeName) {
        current.parentNode?.replaceChild(fresh, current); return;
    }
    if (current.nodeType === Node.TEXT_NODE) {
        if (current.textContent !== fresh.textContent) current.textContent = fresh.textContent;
        return;
    }
    if (!(current instanceof Element) || !(fresh instanceof Element)) return;
    for (const attribute of Array.from(current.attributes)) {
        if (attribute.name !== 'open' && !fresh.hasAttribute(attribute.name))
            current.removeAttribute(attribute.name);
    }
    for (const attribute of Array.from(fresh.attributes)) {
        if (attribute.name !== 'open' && current.getAttribute(attribute.name) !== attribute.value)
            current.setAttribute(attribute.name, attribute.value);
    }
    const oldChildren = Array.from(current.childNodes);
    const newChildren = Array.from(fresh.childNodes);
    for (let index = 0; index < newChildren.length; index++) {
        if (oldChildren[index]) patchWorkTranscript(oldChildren[index], newChildren[index]);
        else current.append(newChildren[index]);
    }
    for (const extra of oldChildren.slice(newChildren.length)) extra.parentNode?.removeChild(extra);
}
