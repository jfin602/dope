/** Copy a conversation response inside the click gesture, including embedded editor browsers. */
export function copyChatText(text: string): Promise<void> {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const selection = window.getSelection();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)) : [];
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
    document.body.append(input);
    input.focus(); input.select();
    const copied = document.execCommand('copy');
    input.remove();
    previousFocus?.focus();
    if (selection) { selection.removeAllRanges(); for (const range of ranges) selection.addRange(range); }
    return copied ? Promise.resolve() :
        navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('Clipboard unavailable'));
}
