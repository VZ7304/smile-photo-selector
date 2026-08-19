import { Hono } from 'hono';
import type { Context } from 'hono';
import { assignProjectSchema, createCustomerSchema } from '@smile/shared';
import type { WorkerBindings } from '../runtime';
import { authenticate, getActiveProject, hasValidCsrf } from '../lib/auth';
import type { Principal } from '../lib/auth';
import { createIssuedPassword, hashPassword, normalizeUsername } from '../lib/security';

export const adminUserRoutes = new Hono<{ Bindings: WorkerBindings }>();

type AppEnv = { Bindings: WorkerBindings };

async function requireAdmin(c: Context<AppEnv>): Promise<
  | { ok: true; principal: Principal }
  | { ok: false; response: Response }
> {
  const principal = await authenticate(c);
  if (!principal) {
    return {
      ok: false,
      response: c.json({ error: { code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' } }, 401),
    };
  }
  if (principal.role !== 'ADMIN') {
    return {
      ok: false,
      response: c.json({ error: { code: 'FORBIDDEN', message: 'Chỉ ADMIN được phép thực hiện thao tác này.' } }, 403),
    };
  }
  return { ok: true, principal };
}

adminUserRoutes.get('/admin/users', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;

  const result = await c.env.DB.prepare(
    `SELECT u.user_id, u.username, u.display_name, u.email, u.role, u.status, u.created_at,
            p.project_id AS active_project_id, p.project_name AS active_project_name, p.status AS active_project_status
     FROM users u
     LEFT JOIN project_users pu ON pu.user_id = u.user_id AND pu.status = 'ACTIVE'
     LEFT JOIN projects p ON p.project_id = pu.project_id
     ORDER BY CASE WHEN u.role = 'ADMIN' THEN 0 ELSE 1 END, u.created_at DESC`,
  ).all<{
    user_id: string;
    username: string;
    display_name: string;
    email: string | null;
    role: 'ADMIN' | 'CUSTOMER';
    status: 'ACTIVE' | 'DISABLED';
    created_at: string;
    active_project_id: string | null;
    active_project_name: string | null;
    active_project_status: string | null;
  }>();

  return c.json({
    users: (result.results ?? []).map((row) => ({
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      activeProject: row.active_project_id
        ? { projectId: row.active_project_id, projectName: row.active_project_name, status: row.active_project_status }
        : null,
    })),
  });
});

adminUserRoutes.post('/admin/users', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;
  if (!hasValidCsrf(c, auth.principal)) {
    return c.json({ error: { code: 'CSRF_FAILED', message: 'Yêu cầu bảo mật không hợp lệ.' } }, 403);
  }

  const parsed = createCustomerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Thông tin tài khoản không hợp lệ.' } }, 400);
  }

  const username = normalizeUsername(parsed.data.username);
  const exists = await c.env.DB.prepare(`SELECT user_id FROM users WHERE username = ? LIMIT 1`).bind(username).first<string>('user_id');
  if (exists) {
    return c.json({ error: { code: 'USERNAME_EXISTS', message: 'Tên đăng nhập đã tồn tại.' } }, 409);
  }

  const issuedPassword = createIssuedPassword();
  const password = await hashPassword(issuedPassword);
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO users
      (user_id, username, password_hash, password_salt, password_hash_params, display_name, email, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'CUSTOMER', 'ACTIVE', ?, ?)`,
  )
    .bind(
      userId,
      username,
      password.hash,
      password.salt,
      password.params,
      parsed.data.displayName.trim(),
      parsed.data.email?.trim() || null,
      now,
      now,
    )
    .run();

  return c.json(
    {
      user: {
        userId,
        username,
        displayName: parsed.data.displayName.trim(),
        email: parsed.data.email?.trim() || null,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        activeProject: null,
      },
      issuedPassword,
    },
    201,
  );
});

adminUserRoutes.post('/admin/users/:id/reset-password', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;
  if (!hasValidCsrf(c, auth.principal)) {
    return c.json({ error: { code: 'CSRF_FAILED', message: 'Yêu cầu bảo mật không hợp lệ.' } }, 403);
  }

  const userId = c.req.param('id');
  const target = await c.env.DB.prepare(`SELECT user_id, username, status FROM users WHERE user_id = ? LIMIT 1`)
    .bind(userId)
    .first<{ user_id: string; username: string; status: string }>();
  if (!target) return c.json({ error: { code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' } }, 404);
  if (target.status !== 'ACTIVE') {
    return c.json({ error: { code: 'USER_DISABLED', message: 'Tài khoản đang bị vô hiệu hóa.' } }, 409);
  }

  const issuedPassword = createIssuedPassword();
  const password = await hashPassword(issuedPassword);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE users SET password_hash = ?, password_salt = ?, password_hash_params = ?, updated_at = ? WHERE user_id = ?`,
    ).bind(password.hash, password.salt, password.params, now, userId),
    c.env.DB.prepare(`UPDATE sessions SET status = 'REVOKED' WHERE user_id = ? AND status = 'ACTIVE'`).bind(userId),
  ]);

  return c.json({ userId, username: target.username, issuedPassword, sessionsRevoked: true });
});

adminUserRoutes.post('/admin/users/:id/assign-project', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;
  if (!hasValidCsrf(c, auth.principal)) {
    return c.json({ error: { code: 'CSRF_FAILED', message: 'Yêu cầu bảo mật không hợp lệ.' } }, 403);
  }

  const parsed = assignProjectSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Album được gán không hợp lệ.' } }, 400);
  }

  const userId = c.req.param('id');
  const target = await c.env.DB.prepare(`SELECT user_id, role, status FROM users WHERE user_id = ? LIMIT 1`)
    .bind(userId)
    .first<{ user_id: string; role: string; status: string }>();
  if (!target) return c.json({ error: { code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' } }, 404);
  if (target.role !== 'CUSTOMER') {
    return c.json({ error: { code: 'INVALID_ROLE', message: 'Chỉ tài khoản CUSTOMER mới được gán album.' } }, 409);
  }
  if (target.status !== 'ACTIVE') {
    return c.json({ error: { code: 'USER_DISABLED', message: 'Tài khoản đang bị vô hiệu hóa.' } }, 409);
  }

  const now = new Date().toISOString();
  if (parsed.data.projectId === null) {
    await c.env.DB.prepare(`UPDATE project_users SET status = 'INACTIVE' WHERE user_id = ? AND status = 'ACTIVE'`)
      .bind(userId)
      .run();
    return c.json({ userId, activeProject: null });
  }

  const project = await c.env.DB.prepare(`SELECT project_id, project_name, status FROM projects WHERE project_id = ? LIMIT 1`)
    .bind(parsed.data.projectId)
    .first<{ project_id: string; project_name: string; status: string }>();
  if (!project) return c.json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Không tìm thấy album.' } }, 404);
  if (!['READY', 'ACTIVE'].includes(project.status)) {
    return c.json({ error: { code: 'PROJECT_NOT_ASSIGNABLE', message: 'Album chưa sẵn sàng để gán cho khách.' } }, 409);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE project_users SET status = 'INACTIVE' WHERE user_id = ? AND status = 'ACTIVE'`).bind(userId),
    c.env.DB.prepare(
      `INSERT INTO project_users (project_id, user_id, status, assigned_at, assigned_by)
       VALUES (?, ?, 'ACTIVE', ?, ?)
       ON CONFLICT(project_id, user_id)
       DO UPDATE SET status = 'ACTIVE', assigned_at = excluded.assigned_at, assigned_by = excluded.assigned_by`,
    ).bind(project.project_id, userId, now, auth.principal.userId),
  ]);

  return c.json({ userId, activeProject: await getActiveProject(c, userId) });
});

adminUserRoutes.get('/admin/projects', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;

  const result = await c.env.DB.prepare(
    `SELECT project_id, project_name, status, image_count, student_count, selection_deadline, created_at
     FROM projects
     ORDER BY created_at DESC`,
  ).all<{
    project_id: string;
    project_name: string;
    status: string;
    image_count: number;
    student_count: number;
    selection_deadline: string | null;
    created_at: string;
  }>();

  return c.json({
    projects: (result.results ?? []).map((row) => ({
      projectId: row.project_id,
      projectName: row.project_name,
      status: row.status,
      imageCount: row.image_count,
      studentCount: row.student_count,
      selectionDeadline: row.selection_deadline,
      createdAt: row.created_at,
      assignable: row.status === 'READY' || row.status === 'ACTIVE',
    })),
  });
});
