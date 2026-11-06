/** Apply an entrance animation only to appended visible text in a fully parsed Markdown tree. */
export function fadeInNewAnswerText(rendered: HTMLElement, previous: string, enabled: boolean): string {
    const nodes: Text[] = [];
    const visit = (element: Element) => {
        if (element.closest('.dope-message-code-header, button')) return;
        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) nodes.push(child as Text);
            else if (child.nodeType === Node.ELEMENT_NODE) visit(child as Element);
        }
    };
    visit(rendered);
    const current = nodes.map(node => node.data).join('');
    if (!enabled || !current.startsWith(previous) || current.length === previous.length) return current;
    let offset = 0;
    for (const node of nodes) {
        const end = offset + node.data.length;
        if (end <= previous.length) { offset = end; continue; }
        const newPart = previous.length > offset ? node.splitText(previous.length - offset) : node;
        const fade = document.createElement('span');
        fade.className = 'dope-chat-answer-fade';
        newPart.parentNode?.replaceChild(fade, newPart);
        fade.append(newPart);
        offset = end;
    }
    return current;
}
