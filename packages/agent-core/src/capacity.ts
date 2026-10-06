/** Narrow provider-neutral capacity signal. Rate limits, transport errors and quota failures are not capacity. */
export function isModelCapacityFailure(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return /\bmodel[_ -]?at[_ -]?capacity\b|\b(?:model|service|server)\b.{0,120}\bat capacity\b|\bat capacity\b.{0,120}\btry again(?: later)?\b/iu.test(error.message);
}
