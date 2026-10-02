import { Pool } from 'pg';
export interface CommandRunner { query(text: string): Promise<unknown> }
export interface Storage extends CommandRunner { transaction(work: (runner: CommandRunner) => Promise<void>): Promise<void> }
export function makeStorage(): Storage {
  const pool = new Pool();
  const query = (text: string) => pool.query(text);
  return { query, async transaction(work) { await work({ query: text => pool.query(text) }); } };
}
