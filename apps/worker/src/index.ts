import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRoutes } from './routes/health';
import type { WorkerBindings } from './runtime';

const app = new Hono<{ Bindings: WorkerBindings }>();

app.use('/api/*', async (c, next) => {
  const middleware = cors({
    origin: c.env.CORS_ORIGIN,
    credentials: true,
    allowHeaders: ['Content-Type', 'X-CSRF-Token'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  return middleware(c, next);
});

app.route('/api/v1', healthRoutes);

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));

app.onError((error, c) => {
  console.error('UNHANDLED_ERROR', { message: error.message });
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
});

export default app;
