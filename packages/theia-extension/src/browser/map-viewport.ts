import type { SemanticDetail } from './physical-map-projection';

/** Relative to the last fitted architecture, with separate enter/exit limits. */
export class MapViewport {
    private baseline?: number;

    fitted(zoom: number): void { if (zoom > 0) this.baseline = zoom; }

    detail(zoom: number, current: SemanticDetail): SemanticDetail {
        if (!this.baseline || zoom <= 0) return current;
        const scale = zoom / this.baseline;
        if (current === 'overview' && scale < 0.8) return current;
        if (current === 'implementation' && scale > 1.25) return current;
        return scale < 0.65 ? 'overview' : scale > 1.5 ? 'implementation' : 'architecture';
    }
}

/** Context identity excludes semantic detail and projected node IDs. */
export const mapFitContext = (workspace: string | undefined, generation: number | undefined, focusId: string | undefined,
    mode: string, planningId: string | undefined, view: string): string =>
    JSON.stringify([workspace, generation, focusId, mode, planningId, view]);
