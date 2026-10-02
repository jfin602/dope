import type { Application } from 'express-serve-static-core';
import type { Storage } from '../state/storage';
export function mount(input: { app: Application; storage: Storage }) {
  const prefix = '/v9/widgets';
  input.app.get(`${prefix}/:widget`, async (_request, reply) => {
    await input.storage.query('SELECT id FROM widgets');
    reply.status(200).json({ ok: true });
  });
  input.app.get('/v9/write', async (_request, reply) => {
    await input.storage.transaction(async runner => {
      await runner.query('INSERT INTO widgets (id) VALUES (1)');
    });
    reply.end();
  });
}
export function unresolved(app: Application, storage: Storage, path: string, sql: string) {
  app.get(path, async (_request, reply) => {
    await storage.query(sql);
    reply.send('unknown');
  });
}
function named(_request: unknown, reply: import('express-serve-static-core').Response) {
  reply.status(204).end();
}
export function mountNamed(app: Application) { app.get('/v9/named', named); }
