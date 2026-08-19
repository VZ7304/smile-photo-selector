import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import type { WorkerBindings } from '../runtime';
import { sha256Base64Url } from './security';

export const SESSION_COOKIE = 'smile_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type AppEnv = { Bindings: WorkerBindings };

export type Role = 'ADMIN' | 'CUSTOMER';

export type Principal = {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  role: Role;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  username: string;
  display_name: string;
  role: Role;
};

export type ActiveProject = {
  projectId: string;
  projectName: string;
  status: string;
};

export async function authenticate(c: Context<AppEnv>): Promise<Principal | null> {
  const rawToken = getCookie(c, SESSION_COOKIE);
  if (!rawToken) return null;

  const tokenHash = await sha256Base64Url(rawToken);
  const row = await c.env.DB.prepare(
    `SELECT s.session_id, u.user_id, u.username, u.display_name, u.role
     FROM sessions s
     JOIN users u ON u.user_id = s.user_id
     WHERE s.token_hash = ?
       AND s.status = 'ACTIVE'
       AND s.expires_at > ?
       AND u.status = 'ACTIVE'
     LIMIT 1`,
  )
    .bind(tokenHash, new Date().toISOString())
    .first<SessionRow>();

  if (!row) return null;
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

export function hasValidCsrf(c: Context<AppEnv>, principal: Principal): boolean {
  const supplied = c.req.header('X-CSRF-Token');
  return typeof supplied === 'string' && supplied.length > 0 && supplied === principal.sessionId;
}

export async function getActiveProject(c: Context<AppEnv>, userId: string): Promise<ActiveProject | null> {
  const row = await c.env.DB.prepare(
    `SELECT p.project_id, p.project_name, p.status
     FROM project_users pu
     JOIN projects p ON p.project_id = pu.project_id
     WHERE pu.user_id = ? AND pu.status = 'ACTIVE'
     LIMIT 1`,
  )
    .bind(userId)
    .first<{ project_id: string; project_name: string; status: string }>();

  if (!row) return null;
  return { projectId: row.project_id, projectName: row.project_name, status: row.status };
}

export function publicUser(principal: Principal) {
  return {
    userId: principal.userId,
    username: principal.username,
    displayName: principal.displayName,
    role: principal.role,
  };
}
