import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { loginSchema } from '@smile/shared';
import type { WorkerBindings } from '../runtime';
import {
  authenticate,
  getActiveProject,
  hasValidCsrf,
  publicUser,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from '../lib/auth';
import { createSessionToken, normalizeUsername, sha256Base64Url, verifyPassword } from '../lib/security';

export const authRoutes = new Hono<{ Bindings: WorkerBindings }>();

type LoginUserRow = {
  user_id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  password_hash_params: string;
  display_name: string;
  role: 'ADMIN' | 'CUSTOMER';
  status: 'ACTIVE' | 'DISABLED';
};

authRoutes.post('/auth/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Thông tin đăng nhập không hợp lệ.' } }, 400);
  }

  const username = normalizeUsername(parsed.data.username);
  const user = await c.env.DB.prepare(
    `SELECT user_id, username, password_hash, password_salt, password_hash_params, display_name, role, status
     FROM users WHERE username = ? LIMIT 1`,
  )
    .bind(username)
    .first<LoginUserRow>();

  if (!user || user.status !== 'ACTIVE') {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Sai tài khoản hoặc mật khẩu.' } }, 401);
  }

  const valid = await verifyPassword(
    parsed.data.password,
    user.password_hash,
    user.password_salt,
    user.password_hash_params,
  );
  if (!valid) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Sai tài khoản hoặc mật khẩu.' } }, 401);
  }

  const sessionId = crypto.randomUUID();
  const rawToken = createSessionToken();
  const tokenHash = await sha256Base64Url(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await c.env.DB.prepare(
    `INSERT INTO sessions
      (session_id, token_hash, user_id, expires_at, last_seen_at, status, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
  )
    .bind(
      sessionId,
      tokenHash,
      user.user_id,
      expiresAt.toISOString(),
      now.toISOString(),
      c.req.header('User-Agent') ?? null,
      now.toISOString(),
    )
    .run();

  setCookie(c, SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: c.env.APP_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  const principal = {
    sessionId,
    userId: user.user_id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
  } as const;

  return c.json({
    user: publicUser(principal),
    csrfToken: sessionId,
    activeProject: await getActiveProject(c, user.user_id),
  });
});

authRoutes.post('/auth/logout', async (c) => {
  const principal = await authenticate(c);
  if (!principal) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Phiên đăng nhập không hợp lệ.' } }, 401);
  if (!hasValidCsrf(c, principal)) {
    return c.json({ error: { code: 'CSRF_FAILED', message: 'Yêu cầu bảo mật không hợp lệ.' } }, 403);
  }

  await c.env.DB.prepare(`UPDATE sessions SET status = 'REVOKED' WHERE session_id = ?`)
    .bind(principal.sessionId)
    .run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const principal = await authenticate(c);
  if (!principal) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' } }, 401);

  return c.json({
    user: publicUser(principal),
    csrfToken: principal.sessionId,
    activeProject: await getActiveProject(c, principal.userId),
  });
});
