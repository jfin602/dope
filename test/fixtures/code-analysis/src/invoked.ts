export function ping(): number { return 1; }
export class Worker { run(): void { ping(); } }
export function cycleA(): void { cycleB(); }
function cycleB(): void { cycleA(); }
export function recur(n: number): void { if (n) recur(n - 1); }
