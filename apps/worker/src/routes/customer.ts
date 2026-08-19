import { Hono } from 'hono';
import type { WorkerBindings } from '../runtime';
import { authenticate, getActiveProject } from '../lib/auth';

export const customerRoutes = new Hono<{ Bindings: WorkerBindings }>();

customerRoutes.get('/projects/current', async (c) => {
  const principal = await authenticate(c);
  if (!principal) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' } }, 401);
  if (principal.role !== 'CUSTOMER') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'API này chỉ dành cho CUSTOMER.' } }, 403);
  }

  return c.json({ project: await getActiveProject(c, principal.userId) });
});
