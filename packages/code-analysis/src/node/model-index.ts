import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { assembleModel } from '@dope/software-model';
import type { ModelStatus, PhysicalModelSnapshot } from '@dope/software-model';
import type { CodeAnalysisResult } from '../index';
import { readArchitecture } from './architecture-file';

const skipped = new Set(['node_modules', '.git', '.dope', '.theia', 'plugins', 'dist', 'build', 'out', 'coverage', 'generated', 'vendor']);
const source = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const config = /^(?:tsconfig|jsconfig)(?:\.[^/]*)?\.json$/;
const failed = (message: string): ModelStatus['analysis'] => ({ completeness: 'failed', errors: [{ producer: '@dope/code-analysis', code: 'index-failure', message }] });
const idle = (): ModelStatus => ({ generation: 0, publishedGeneration: 0, state: 'idle', analysis: failed('Analysis has not run'), reusedSourceFiles: 0 });

interface Inputs { sourceFingerprint: string; configFingerprint: string; declarationFingerprint: string; fingerprint: string }
interface Entry { requested: number; status: ModelStatus; snapshot?: PhysicalModelSnapshot; inputs?: Inputs; result?: CodeAnalysisResult }
export interface IndexAnalyzer {
    analyze(root: string): CodeAnalysisResult | Promise<CodeAnalysisResult>;
    reset?(root: string): void;
    inputPaths?(root: string): { sources: string[]; configs: string[] };
}

async function fingerprints(root: string, declarationText?: string, paths?: { sources: string[]; configs: string[] }): Promise<Inputs> {
    const sourceHash = createHash('sha256');
    const configHash = createHash('sha256');
    const walk = async (directory: string): Promise<void> => {
        for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            if (entry.isDirectory()) { if (!skipped.has(entry.name)) await walk(join(directory, entry.name)); continue; }
            if (!entry.isFile()) continue;
            const path = join(directory, entry.name);
            const hash = config.test(entry.name) || entry.name === 'package.json' ? configHash : source.test(entry.name) ? sourceHash : undefined;
            if (!hash) continue;
            hash.update(relative(root, path).replaceAll('\\', '/')).update('\0').update(await readFile(path)).update('\0');
        }
    };
    if (paths) {
        for (const [files, hash] of [[paths.sources, sourceHash], [paths.configs, configHash]] as const) {
            for (const path of files) hash.update(relative(root, path).replaceAll('\\', '/')).update('\0').update(await readFile(path)).update('\0');
        }
    } else await walk(root);
    const sourceFingerprint = sourceHash.digest('hex');
    const configFingerprint = configHash.digest('hex');
    const declarationFingerprint = createHash('sha256').update(declarationText ?? '<missing>').digest('hex');
    const fingerprint = createHash('sha256').update(sourceFingerprint).update(configFingerprint).update(declarationFingerprint).digest('hex');
    return { sourceFingerprint, configFingerprint, declarationFingerprint, fingerprint };
}

/** One disposable, per-project in-memory index. Latest requested generation is the only publisher. */
export class ModelIndex {
    private readonly entries = new Map<string, Entry>();
    private readonly listeners = new Set<(root: string, status: ModelStatus) => void>();

    constructor(private readonly analyzer: IndexAnalyzer) { }

    onChange(listener: (root: string, status: ModelStatus) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private notify(root: string, status: ModelStatus): void {
        for (const listener of this.listeners) { try { listener(root, status); } catch { /* A closed RPC client cannot affect analysis. */ } }
    }
    status(root: string): ModelStatus { return structuredClone(this.entries.get(root)?.status ?? idle()); }
    snapshot(root: string): PhysicalModelSnapshot | undefined { return this.entries.get(root)?.snapshot; }

    async analyze(root: string): Promise<ModelStatus> {
        const entry = this.entries.get(root) ?? { requested: 0, status: idle() };
        this.entries.set(root, entry);
        const generation = ++entry.requested;
        entry.status = { ...entry.status, generation, state: 'analyzing', reusedSourceFiles: 0 };
        this.notify(root, this.status(root));
        try {
            const { architecture, text } = await readArchitecture(root);
            const inputs = await fingerprints(root, text, this.analyzer.inputPaths?.(root));
            const previous = entry.inputs;
            const same = previous?.fingerprint === inputs.fingerprint && entry.result;
            if (previous && (previous.configFingerprint !== inputs.configFingerprint ||
                previous.declarationFingerprint !== inputs.declarationFingerprint)) this.analyzer.reset?.(root);
            const result = same ? undefined : await this.analyzer.analyze(root);
            if (generation !== entry.requested) return this.status(root);
            const analysis = (result ?? entry.result!).status;
            const snapshot = assembleModel({ projectId: 'project:root', generation, inputFingerprint: inputs.fingerprint, analysis }, architecture, result ?? entry.result!);
            entry.snapshot = snapshot;
            entry.inputs = inputs;
            entry.result = result ?? entry.result;
            entry.status = { generation, publishedGeneration: generation, state: analysis.completeness === 'failed' ? 'failed' : 'ready', analysis,
                inputFingerprint: inputs.fingerprint, reusedSourceFiles: result?.reusedSourceFiles ?? (same ? snapshot.nodes.filter(node => node.kind === 'code' && node.codeKind === 'file').length : 0) };
        } catch (error) {
            if (generation !== entry.requested) return this.status(root);
            this.analyzer.reset?.(root);
            entry.snapshot = undefined;
            entry.inputs = undefined;
            entry.result = undefined;
            entry.status = { generation, publishedGeneration: 0, state: 'failed', analysis: failed(String(error)), reusedSourceFiles: 0 };
        }
        this.notify(root, this.status(root));
        return this.status(root);
    }
}
