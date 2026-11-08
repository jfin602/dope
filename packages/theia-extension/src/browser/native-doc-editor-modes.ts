/** Only real Markdown and plain-text files receive document presentation controls. */
export type NativeDocumentFormat = 'md' | 'txt';
export type NativeDocumentMode = 'source' | 'diff' | 'formatted';

export function nativeDocumentFormat(scheme: string, path: string): NativeDocumentFormat | undefined {
    if (scheme !== 'file') return undefined;
    if (/\.md$/iu.test(path)) return 'md';
    if (/\.txt$/iu.test(path)) return 'txt';
    return undefined;
}

export function nativeDocumentModes(format: NativeDocumentFormat, hasCompareBasis: boolean): readonly NativeDocumentMode[] {
    return format === 'md'
        ? hasCompareBasis ? ['source', 'diff', 'formatted'] : ['source', 'formatted']
        : hasCompareBasis ? ['source', 'diff'] : ['source'];
}
