import type { ClipboardSnapshot } from './clipboard-history';

export const clipboardHistoryPath = '/services/dope-clipboard-history';
export interface ClipboardHistoryService {
    revision(): Promise<number>;
    snapshot(): Promise<ClipboardSnapshot>;
    restore(id: string): Promise<boolean>;
    setPaused(paused: boolean): Promise<void>;
    setLimit(limit: number): Promise<void>;
    setSkipLikelySecrets(value: boolean): Promise<void>;
    pin(id: string, pinned: boolean): Promise<boolean>;
    delete(id: string): Promise<void>;
    clear(): Promise<void>;
}
