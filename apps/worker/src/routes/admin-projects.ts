import { Hono } from 'hono';
import type { Context } from 'hono';
import { createProjectSchema, importImageBatchSchema } from '@smile/shared';
import type { WorkerBindings } from '../runtime';
import { authenticate, hasValidCsrf } from '../lib/auth';
import type { Principal } from '../lib/auth';

export const adminProjectRoutes = new Hono<{ Bindings: WorkerBindings }>();
type AppEnv = { Bindings: WorkerBindings };

async function requireAdmin(c: Context<AppEnv>): Promise<{ ok: true; principal: Principal } | { ok: false; response: Response }> {
  const principal = await authenticate(c);
  if (!principal) return { ok: false, response: c.json({ error: { code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' } }, 401) };
  if (principal.role !== 'ADMIN') return { ok: false, response: c.json({ error: { code: 'FORBIDDEN', message: 'Chỉ ADMIN được phép thực hiện thao tác này.' } }, 403) };
  return { ok: true, principal };
}

function extractDriveFolderId(value: string): string | null {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]{15,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

adminProjectRoutes.get('/admin/drive/config', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;
  const clientId = c.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '';
  return c.json({ configured: clientId.length > 0, clientId: clientId || null, scope: 'https://www.googleapis.com/auth/drive.readonly' });
});

adminProjectRoutes.post('/admin/projects', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;
  if (!hasValidCsrf(c, auth.principal)) return c.json({ error: { code: 'CSRF_FAILED', message: 'Yêu cầu bảo mật không hợp lệ.' } }, 403);

  const parsed = createProjectSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'INVALID_INPUT', message: 'Thông tin album không hợp lệ.' } }, 400);

  const folderId = extractDriveFolderId(parsed.data.folderUrl);
  if (!folderId) return c.json({ error: { code: 'INVALID_DRIVE_FOLDER', message: 'Link thư mục Google Drive không hợp lệ.' } }, 400);

  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const studentCount = parsed.data.studentCount;

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO projects
       (project_id, project_name, original_folder_id, status, student_count, large_limit, small_limit,
        selection_deadline, notes, image_count, visual_index_status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'IMPORTING', ?, 1, ?, ?, ?, 0, 'NOT_STARTED', ?, ?, ?)`,
    ).bind(
      projectId,
      parsed.data.projectName.trim(),
      folderId,
      studentCount,
      studentCount * 2,
      parsed.data.selectionDeadline || null,
      parsed.data.notes?.trim() || null,
      auth.principal.userId,
      now,
      now,
    ),
    c.env.DB.prepare(
      `INSERT INTO jobs (job_id, project_id, type, status, processed, total, success, failed, retry, started_at, updated_at)
       VALUES (?, ?, 'DRIVE_IMPORT', 'RUNNING', 0, 0, 0, 0, 0, ?, ?)`,
    ).bind(jobId, projectId, now, now),
  ]);

  return c.json({
    project: {
      projectId,
      projectName: parsed.data.projectName.trim(),
      originalFolderId: folderId,
      status: 'IMPORTING',
      imageCount: 0,
      studentCount,
      selectionDeadline: parsed.data.selectionDeadline || null,
      assignable: false,
    },
    jobId,
  }, 201);
});

adminProjectRoutes.post('/admin/projects/:id/import-batch', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;
  if (!hasValidCsrf(c, auth.principal)) return c.json({ error: { code: 'CSRF_FAILED', message: 'Yêu cầu bảo mật không hợp lệ.' } }, 403);

  const projectId = c.req.param('id');
  const project = await c.env.DB.prepare(`SELECT project_id, status FROM projects WHERE project_id = ? LIMIT 1`)
    .bind(projectId)
    .first<{ project_id: string; status: string }>();
  if (!project) return c.json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Không tìm thấy album.' } }, 404);
  if (project.status !== 'IMPORTING') return c.json({ error: { code: 'PROJECT_NOT_IMPORTING', message: 'Album hiện không ở trạng thái import.' } }, 409);

  const parsed = importImageBatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'INVALID_INPUT', message: 'Batch ảnh không hợp lệ.' } }, 400);

  const now = new Date().toISOString();
  const statements = parsed.data.items.map((item, index) => {
    const sequence = parsed.data.batchStart + index + 1;
    const imageKey = `${projectId}:${item.originalFileId}`;
    return c.env.DB.prepare(
      `INSERT INTO images
       (image_key, project_id, original_file_id, file_name, normalized_name, mime_type, size, md5_checksum,
        width, height, original_drive_url, sequence, status, source_created_at, source_modified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)
       ON CONFLICT(project_id, original_file_id) DO UPDATE SET
         file_name = excluded.file_name,
         normalized_name = excluded.normalized_name,
         mime_type = excluded.mime_type,
         size = excluded.size,
         md5_checksum = excluded.md5_checksum,
         width = excluded.width,
         height = excluded.height,
         original_drive_url = excluded.original_drive_url,
         source_created_at = excluded.source_created_at,
         source_modified_at = excluded.source_modified_at,
         updated_at = excluded.updated_at`,
    ).bind(
      imageKey,
      projectId,
      item.originalFileId,
      item.fileName,
      normalizeName(item.fileName),
      item.mimeType,
      item.size,
      item.md5Checksum,
      item.width,
      item.height,
      `https://drive.google.com/file/d/${encodeURIComponent(item.originalFileId)}/view`,
      sequence,
      item.createdTime,
      item.modifiedTime,
      now,
      now,
    );
  });

  if (statements.length > 0) await c.env.DB.batch(statements);
  const imageCount = (await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM images WHERE project_id = ? AND status = 'ACTIVE'`)
    .bind(projectId)
    .first<number>('count')) ?? 0;

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE projects SET image_count = ?, updated_at = ? WHERE project_id = ?`).bind(imageCount, now, projectId),
    c.env.DB.prepare(
      `UPDATE jobs SET processed = ?, success = ?, total = CASE WHEN total < ? THEN ? ELSE total END, updated_at = ?
       WHERE project_id = ? AND type = 'DRIVE_IMPORT' AND status = 'RUNNING'`,
    ).bind(imageCount, imageCount, imageCount, imageCount, now, projectId),
  ]);

  return c.json({ projectId, accepted: parsed.data.items.length, imageCount });
});

adminProjectRoutes.post('/admin/projects/:id/finalize-import', async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.response;
  if (!hasValidCsrf(c, auth.principal)) return c.json({ error: { code: 'CSRF_FAILED', message: 'Yêu cầu bảo mật không hợp lệ.' } }, 403);

  const projectId = c.req.param('id');
  const project = await c.env.DB.prepare(`SELECT project_id, status FROM projects WHERE project_id = ? LIMIT 1`)
    .bind(projectId)
    .first<{ project_id: string; status: string }>();
  if (!project) return c.json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Không tìm thấy album.' } }, 404);
  if (project.status !== 'IMPORTING') return c.json({ error: { code: 'PROJECT_NOT_IMPORTING', message: 'Album hiện không ở trạng thái import.' } }, 409);

  const imageCount = (await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM images WHERE project_id = ? AND status = 'ACTIVE'`)
    .bind(projectId)
    .first<number>('count')) ?? 0;
  if (imageCount < 1) return c.json({ error: { code: 'NO_IMAGES', message: 'Không tìm thấy ảnh hợp lệ trong thư mục Drive.' } }, 409);

  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE projects SET status = 'READY', image_count = ?, updated_at = ? WHERE project_id = ?`).bind(imageCount, now, projectId),
    c.env.DB.prepare(
      `UPDATE jobs SET status = 'DONE', processed = ?, total = ?, success = ?, updated_at = ?, finished_at = ?
       WHERE project_id = ? AND type = 'DRIVE_IMPORT' AND status = 'RUNNING'`,
    ).bind(imageCount, imageCount, imageCount, now, now, projectId),
  ]);

  return c.json({ projectId, status: 'READY', imageCount, assignable: true });
});
