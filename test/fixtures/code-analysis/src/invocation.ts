import { ping as aliased, Worker, cycleA } from './invoked';

export function execute(): void {
  aliased();
  new Worker().run();
  const arrow = () => aliased();
  arrow();
  const expression = function () { aliased(); };
  expression();
  runCallback(() => aliased());
  cycleA();
  Math.max(1, 2);
}

function runCallback(callback: () => number): void { callback(); }
export async function load(): Promise<void> { await (aliased()); }
