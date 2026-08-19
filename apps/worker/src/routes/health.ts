import { Hono } from 'hono';
import type { WorkerBindings } from '../runtime';

export const healthRoutes = new Hono<{ Bindings: WorkerBindings }>();

healthRoutes.get('/health', async (c) => {
  let d1: 'ok' | 'error' = 'ok';
  try {
    const result = await c.env.DB.prepare('SELECT 1 AS ok').first<number>('ok');
    if (result !== 1) d1 = 'error';
  } catch {
    d1 = 'error';
  }

  const status = d1 === 'ok' ? 'ok' : 'degraded';
  return c.json(
    {
      service: 'smile-photo-selector-api',
      version: c.env.APP_VERSION,
      status,
      d1,
      environment: c.env.APP_ENV,
      timestamp: new Date().toISOString(),
    },
    status === 'ok' ? 200 : 503,
  );
});
