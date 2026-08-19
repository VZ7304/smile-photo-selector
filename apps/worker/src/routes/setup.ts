import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { createInitialAdminSchema } from '@smile/shared';
import type { WorkerBindings } from '../runtime';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '../lib/auth';
import { createSessionToken, hashPassword, normalizeUsername, sha256Base64Url } from '../lib/security';

export const setupRoutes = new Hono<{ Bindings: WorkerBindings }>();

async function hasAdmin(db: WorkerBindings['DB']): Promise<boolean> {
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN'`).first<number>('count');
  return (count ?? 0) > 0;
}

setupRoutes.get('/setup/status', async (c) => {
  return c.json({ needsSetup: !(await hasAdmin(c.env.DB)) });
});

setupRoutes.post('/setup/admin', async (c) => {
  if (await hasAdmin(c.env.DB)) {
    return c.json({ error: { code: 'SETUP_CLOSED', message: 'ADMIN đầu tiên đã được tạo. Thiết lập ban đầu đã khóa.' } }, 409);
  }

  const parsed = createInitialAdminSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Thông tin ADMIN không hợp lệ.' } }, 400);
  }

  const username = normalizeUsername(parsed.data.username);
  const usernameExists = await c.env.DB.prepare(`SELECT user_id FROM users WHERE username = ? LIMIT 1`)
    .bind(username)
    .first<string>('user_id');
  if (usernameExists) {
    return c.json({ error: { code: 'USERNAME_EXISTS', message: 'Tên đăng nhập đã tồn tại.' } }, 409);
  }

  const password = await hashPassword(parsed.data.password);
  const now = new Date();
  const nowIso = now.toISOString();
  const userId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO users
      (user_id, username, password_hash, password_salt, password_hash_params, display_name, email, role, status, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, 'ADMIN', 'ACTIVE', ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'ADMIN')`,
  )
    .bind(
      userId,
      username,
      password.hash,
      password.salt,
      password.params,
      parsed.data.displayName.trim(),
      parsed.data.email?.trim() || null,
      nowIso,
      nowIso,
    )
    .run();

  const inserted = await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = ? AND role = 'ADMIN' LIMIT 1`)
    .bind(userId)
    .first<string>('user_id');
  if (!inserted) {
    return c.json({ error: { code: 'SETUP_RACE', message: 'ADMIN đầu tiên đã được tạo bởi một yêu cầu khác.' } }, 409);
  }

  const sessionId = crypto.randomUUID();
  const rawToken = createSessionToken();
  const tokenHash = await sha256Base64Url(rawToken);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await c.env.DB.prepare(
    `INSERT INTO sessions
      (session_id, token_hash, user_id, expires_at, last_seen_at, status, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
  )
    .bind(
      sessionId,
      tokenHash,
      userId,
      expiresAt.toISOString(),
      nowIso,
      c.req.header('User-Agent') ?? null,
      nowIso,
    )
    .run();

  setCookie(c, SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: c.env.APP_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return c.json(
    {
      user: {
        userId,
        username,
        displayName: parsed.data.displayName.trim(),
        role: 'ADMIN' as const,
      },
      csrfToken: sessionId,
      activeProject: null,
    },
    201,
  );
});
