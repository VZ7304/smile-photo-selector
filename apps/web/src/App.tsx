import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

type Role = 'ADMIN' | 'CUSTOMER';
type ActiveProject = { projectId: string; projectName: string; status: string };
type Session = {
  user: { userId: string; username: string; displayName: string; role: Role };
  csrfToken: string;
  activeProject: ActiveProject | null;
};
type AdminUser = {
  userId: string;
  username: string;
  displayName: string;
  email: string | null;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  activeProject: ActiveProject | null;
};
type AdminProject = ActiveProject & {
  imageCount: number;
  studentCount: number;
  selectionDeadline: string | null;
  createdAt: string;
  assignable: boolean;
};
type IssuedCredential = { title: string; username: string; password: string };
type ApiErrorBody = { error?: { message?: string } };
type DriveConfig = { configured: boolean; clientId: string | null; scope: string };
type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleTokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  createdTime?: string;
  modifiedTime?: string;
  imageMediaMetadata?: { width?: number; height?: number };
};
type DriveListResponse = { files?: DriveFile[]; nextPageToken?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
let googleScriptPromise: Promise<void> | null = null;

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}/api/v1${path}`, { ...init, credentials: 'include', headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function Brand() {
  return <div className="brand"><div className="brand-mark">S</div><div><strong>SMILE MEDIA</strong><span>Photo Selector</span></div></div>;
}

function LoadingScreen() {
  return <main className="auth-shell"><section className="auth-card loading-card"><Brand /><div className="loader" /><p>Đang kết nối hệ thống…</p></section></main>;
}

function SetupScreen({ onReady }: { onReady: (session: Session) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirm') ?? '')) return setError('Mật khẩu nhập lại chưa khớp.');
    setBusy(true);
    try {
      const session = await api<Session>('/setup/admin', { method: 'POST', body: JSON.stringify({ username: String(form.get('username') ?? ''), displayName: String(form.get('displayName') ?? ''), email: String(form.get('email') ?? ''), password }) });
      onReady(session);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo ADMIN.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><section className="auth-card wide-auth"><Brand /><div className="auth-heading"><span className="pill">THIẾT LẬP LẦN ĐẦU</span><h1>Tạo tài khoản quản trị</h1><p>Form này chỉ hoạt động khi hệ thống chưa có ADMIN. Tạo xong sẽ tự khóa vĩnh viễn.</p></div><form className="form-grid" onSubmit={submit}><label>Tên đăng nhập<input name="username" autoComplete="username" required minLength={3} placeholder="smileadmin" /></label><label>Tên hiển thị<input name="displayName" required placeholder="SMILE MEDIA Admin" /></label><label className="full-field">Email <span className="optional">(không bắt buộc)</span><input name="email" type="email" autoComplete="email" placeholder="studio@example.com" /></label><label>Mật khẩu<input name="password" type="password" autoComplete="new-password" required minLength={10} /></label><label>Nhập lại mật khẩu<input name="confirm" type="password" autoComplete="new-password" required minLength={10} /></label>{error ? <div className="alert error full-field">{error}</div> : null}<button className="primary full-field" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo ADMIN và vào hệ thống'}</button></form></section></main>;
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { onLogin(await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ username: String(form.get('username') ?? ''), password: String(form.get('password') ?? '') }) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><section className="auth-card"><Brand /><div className="auth-heading"><span className="pill">SMILE MEDIA</span><h1>Đăng nhập</h1><p>Khách hàng dùng đúng tài khoản và mật khẩu do studio cấp.</p></div><form className="stack-form" onSubmit={submit}><label>Tên đăng nhập<input name="username" autoComplete="username" required autoFocus /></label><label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required /></label>{error ? <div className="alert error">{error}</div> : null}<button className="primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button></form></section></main>;
}

function IssuedPanel({ credential, onClose }: { credential: IssuedCredential; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(`Tài khoản: ${credential.username}\nMật khẩu: ${credential.password}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  return <div className="issued-panel"><div><span className="pill warning-pill">CHỈ HIỆN LẦN NÀY</span><h3>{credential.title}</h3><p>Gửi thông tin này cho khách trước khi đóng. Hệ thống không lưu mật khẩu dạng đọc được.</p></div><div className="credential-box"><span>Tài khoản</span><strong>{credential.username}</strong></div><div className="credential-box"><span>Mật khẩu</span><strong>{credential.password}</strong></div><div className="button-row"><button className="primary" onClick={() => void copy()}>{copied ? 'Đã sao chép' : 'Sao chép tài khoản + mật khẩu'}</button><button className="ghost" onClick={onClose}>Đã lưu, đóng</button></div></div>;
}

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Google Identity Services.'));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

async function requestDriveToken(config: DriveConfig): Promise<string> {
  if (!config.clientId) throw new Error('Chưa cấu hình Google OAuth Client ID.');
  await loadGoogleIdentity();
  return new Promise<string>((resolve, reject) => {
    const oauth2 = window.google?.accounts.oauth2;
    if (!oauth2) return reject(new Error('Google Identity Services chưa sẵn sàng.'));
    const client = oauth2.initTokenClient({
      client_id: config.clientId!,
      scope: config.scope,
      callback: (response) => response.access_token ? resolve(response.access_token) : reject(new Error(response.error_description ?? response.error ?? 'Google không cấp quyền Drive.')),
      error_callback: () => reject(new Error('Không mở được cửa sổ đăng nhập Google.')),
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

function extractDriveFolderId(value: string): string | null {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]{15,}$/.test(trimmed)) return trimmed;
  return (trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/))?.[1] ?? null;
}

async function driveFetch<T>(accessToken: string, url: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Google Drive HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function verifyDriveFolder(accessToken: string, folderId: string): Promise<string> {
  const params = new URLSearchParams({ fields: 'id,name,mimeType', supportsAllDrives: 'true' });
  const folder = await driveFetch<DriveFile>(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?${params}`);
  if (folder.mimeType !== DRIVE_FOLDER_MIME) throw new Error('Link đã dán không phải thư mục Google Drive.');
  return folder.name;
}

function toImagePayload(file: DriveFile) {
  const size = file.size ? Number(file.size) : null;
  return {
    originalFileId: file.id,
    fileName: file.name,
    mimeType: file.mimeType,
    size: size !== null && Number.isSafeInteger(size) ? size : null,
    md5Checksum: file.md5Checksum ?? null,
    width: file.imageMediaMetadata?.width ?? null,
    height: file.imageMediaMetadata?.height ?? null,
    createdTime: file.createdTime ?? null,
    modifiedTime: file.modifiedTime ?? null,
  };
}

async function scanDriveIntoProject(input: {
  accessToken: string;
  folderId: string;
  projectId: string;
  csrfToken: string;
  onProgress: (text: string) => void;
}): Promise<number> {
  const pendingFolders = [input.folderId];
  const seenFolders = new Set<string>();
  const seenImages = new Set<string>();
  let imported = 0;

  while (pendingFolders.length > 0) {
    const currentFolder = pendingFolders.shift()!;
    if (seenFolders.has(currentFolder)) continue;
    seenFolders.add(currentFolder);
    let pageToken = '';
    do {
      const params = new URLSearchParams({
        q: `'${currentFolder}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,md5Checksum,createdTime,modifiedTime,imageMediaMetadata(width,height))',
        pageSize: '1000',
        orderBy: 'name_natural',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const result = await driveFetch<DriveListResponse>(input.accessToken, `https://www.googleapis.com/drive/v3/files?${params}`);
      const images: DriveFile[] = [];
      for (const file of result.files ?? []) {
        if (file.mimeType === DRIVE_FOLDER_MIME) pendingFolders.push(file.id);
        else if (file.mimeType.startsWith('image/') && !seenImages.has(file.id)) { seenImages.add(file.id); images.push(file); }
      }
      for (let offset = 0; offset < images.length; offset += 75) {
        const chunk = images.slice(offset, offset + 75);
        await api(`/admin/projects/${input.projectId}/import-batch`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': input.csrfToken },
          body: JSON.stringify({ batchStart: imported, items: chunk.map(toImagePayload) }),
        });
        imported += chunk.length;
        input.onProgress(`Đã đọc ${imported.toLocaleString('vi-VN')} ảnh · ${seenFolders.size} thư mục…`);
      }
      pageToken = result.nextPageToken ?? '';
    } while (pageToken);
  }

  await api(`/admin/projects/${input.projectId}/finalize-import`, { method: 'POST', headers: { 'X-CSRF-Token': input.csrfToken }, body: JSON.stringify({}) });
  return imported;
}

function AdminDashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<'accounts' | 'albums'>('accounts');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [driveConfig, setDriveConfig] = useState<DriveConfig | null>(null);
  const [driveToken, setDriveToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<IssuedCredential | null>(null);
  const [importProgress, setImportProgress] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [usersResult, projectsResult, configResult] = await Promise.all([
        api<{ users: AdminUser[] }>('/admin/users'),
        api<{ projects: AdminProject[] }>('/admin/projects'),
        api<DriveConfig>('/admin/drive/config'),
      ]);
      setUsers(usersResult.users); setProjects(projectsResult.projects); setDriveConfig(configResult);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu quản trị.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function ensureDriveToken(): Promise<string> {
    if (driveToken) return driveToken;
    if (!driveConfig?.configured) throw new Error('Google Drive chưa được cấu hình. Cần thêm GOOGLE_OAUTH_CLIENT_ID vào Cloudflare trước.');
    const token = await requestDriveToken(driveConfig); setDriveToken(token); return token;
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      const result = await api<{ user: AdminUser; issuedPassword: string }>('/admin/users', { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify({ username: String(form.get('username') ?? ''), displayName: String(form.get('displayName') ?? ''), email: String(form.get('email') ?? '') }) });
      setIssued({ title: 'Tài khoản khách vừa tạo', username: result.user.username, password: result.issuedPassword }); formElement.reset(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tạo được tài khoản.'); }
    finally { setBusy(false); }
  }

  async function resetPassword(user: AdminUser) {
    if (!window.confirm(`Cấp mật khẩu mới cho ${user.displayName}? Tất cả phiên đăng nhập cũ sẽ bị đăng xuất.`)) return;
    setBusy(true); setError('');
    try {
      const result = await api<{ username: string; issuedPassword: string }>(`/admin/users/${user.userId}/reset-password`, { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken }, body: '{}' });
      setIssued({ title: `Mật khẩu mới · ${user.displayName}`, username: result.username, password: result.issuedPassword }); setMessage('Đã reset mật khẩu và thu hồi toàn bộ phiên đăng nhập cũ.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không reset được mật khẩu.'); }
    finally { setBusy(false); }
  }

  async function assignProject(user: AdminUser, value: string) {
    setBusy(true); setError(''); setMessage('');
    try { await api(`/admin/users/${user.userId}/assign-project`, { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify({ projectId: value || null }) }); setMessage(value ? `Đã gán album cho ${user.displayName}.` : `Đã hủy gán album của ${user.displayName}.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thay đổi được album.'); }
    finally { setBusy(false); }
  }

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage(''); setImportProgress('Đang xin quyền đọc Google Drive…');
    const formElement = event.currentTarget; const form = new FormData(formElement);
    const folderUrl = String(form.get('folderUrl') ?? '');
    const folderId = extractDriveFolderId(folderUrl);
    if (!folderId) { setBusy(false); setImportProgress(''); return setError('Link thư mục Google Drive không hợp lệ.'); }
    try {
      const token = await ensureDriveToken();
      setImportProgress('Đang kiểm tra thư mục Drive…');
      const driveFolderName = await verifyDriveFolder(token, folderId);
      const projectNameInput = String(form.get('projectName') ?? '').trim();
      const deadlineRaw = String(form.get('selectionDeadline') ?? '');
      const created = await api<{ project: AdminProject & { originalFolderId: string } }>('/admin/projects', {
        method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify({
          projectName: projectNameInput || driveFolderName,
          folderUrl,
          studentCount: Number(form.get('studentCount') ?? 1),
          selectionDeadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : '',
          notes: String(form.get('notes') ?? ''),
        }),
      });
      setImportProgress('Đang quét ảnh trong Drive…');
      const count = await scanDriveIntoProject({ accessToken: token, folderId: created.project.originalFolderId, projectId: created.project.projectId, csrfToken: session.csrfToken, onProgress: setImportProgress });
      setMessage(`Album “${created.project.projectName}” đã READY với ${count.toLocaleString('vi-VN')} ảnh.`);
      setImportProgress(''); formElement.reset(); await load();
    } catch (cause) {
      if (cause instanceof Error && /401|invalid credentials|unauthenticated/i.test(cause.message)) setDriveToken('');
      setError(cause instanceof Error ? cause.message : 'Không import được Google Drive.');
      setImportProgress('');
    } finally { setBusy(false); }
  }

  const customers = users.filter((user) => user.role === 'CUSTOMER');
  const assignableProjects = projects.filter((project) => project.assignable);

  return <main className="app-shell"><header className="topbar"><Brand /><div className="topbar-right"><div className="signed-in"><span>ADMIN</span><strong>{session.user.displayName}</strong></div><button className="ghost" onClick={onLogout}>Đăng xuất</button></div></header><div className="page-wrap">
    <nav className="tabs"><button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Khách hàng</button><button className={tab === 'albums' ? 'active' : ''} onClick={() => setTab('albums')}>Album & Drive</button></nav>
    {issued ? <IssuedPanel credential={issued} onClose={() => setIssued(null)} /> : null}{error ? <div className="alert error">{error}</div> : null}{message ? <div className="alert success">{message}</div> : null}{importProgress ? <div className="alert progress">{importProgress}</div> : null}

    {tab === 'accounts' ? <><section className="hero-row"><div><span className="pill">QUẢN TRỊ</span><h1>Tài khoản khách hàng</h1><p>Tạo tài khoản, cấp lại mật khẩu và quản lý album ACTIVE của từng khách.</p></div><div className="stat-card"><span>Khách hàng</span><strong>{customers.length}</strong><small>{projects.length} album trong hệ thống</small></div></section><div className="admin-grid"><section className="panel"><div className="panel-heading"><div><span className="section-label">TẠO MỚI</span><h2>Cấp tài khoản khách</h2></div></div><form className="stack-form compact" onSubmit={createCustomer}><label>Tên khách / lớp<input name="displayName" required placeholder="Nguyễn Văn A · 12A1" /></label><label>Tên đăng nhập<input name="username" required minLength={3} placeholder="12a1.nguyenvana" /></label><label>Email <span className="optional">(không bắt buộc)</span><input name="email" type="email" placeholder="khach@example.com" /></label><button className="primary" disabled={busy}>Tạo tài khoản & cấp mật khẩu</button><p className="form-note">Mật khẩu ngẫu nhiên chỉ hiện ngay sau khi tạo.</p></form></section><section className="panel table-panel"><div className="panel-heading"><div><span className="section-label">DANH SÁCH</span><h2>Khách hàng</h2></div><button className="ghost small-button" onClick={() => void load()} disabled={loading}>Làm mới</button></div>{loading ? <div className="empty-state">Đang tải…</div> : customers.length === 0 ? <div className="empty-state">Chưa có tài khoản khách.</div> : <div className="customer-list">{customers.map((user) => <article className="customer-row" key={user.userId}><div className="customer-main"><strong>{user.displayName}</strong><span>@{user.username}{user.email ? ` · ${user.email}` : ''}</span></div><div className="assignment"><label>Album đang gán<select value={user.activeProject?.projectId ?? ''} onChange={(event) => void assignProject(user, event.currentTarget.value)} disabled={busy}><option value="">Chưa gán album</option>{assignableProjects.map((project) => <option value={project.projectId} key={project.projectId}>{project.projectName} · {project.imageCount} ảnh</option>)}</select></label><button className="ghost" onClick={() => void resetPassword(user)} disabled={busy}>Reset mật khẩu</button></div></article>)}</div>}</section></div></> : null}

    {tab === 'albums' ? <><section className="hero-row"><div><span className="pill">PHASE 3</span><h1>Album & Google Drive</h1><p>Dán link folder Drive. Hệ thống chỉ lấy metadata; ảnh gốc vẫn nằm nguyên trong Google Drive.</p></div><div className="stat-card"><span>Album</span><strong>{projects.length}</strong><small>{projects.reduce((sum, project) => sum + project.imageCount, 0).toLocaleString('vi-VN')} ảnh đã index</small></div></section><div className="admin-grid album-grid"><section className="panel"><div className="panel-heading"><div><span className="section-label">IMPORT DRIVE</span><h2>Tạo album mới</h2></div></div>{driveConfig && !driveConfig.configured ? <div className="setup-notice"><strong>Chưa kết nối Google Drive</strong><span>Cần cấu hình Google OAuth Client ID một lần trong Cloudflare.</span></div> : <div className="drive-ready"><span className="status-dot" /> Google Drive đã sẵn sàng</div>}<form className="stack-form compact" onSubmit={createAlbum}><label>Tên album<input name="projectName" placeholder="Kỷ yếu 12A1 · 2026" /></label><label>Link thư mục Google Drive<input name="folderUrl" required placeholder="https://drive.google.com/drive/folders/..." /></label><div className="two-cols"><label>Số học sinh<input name="studentCount" type="number" min={1} max={500} defaultValue={1} required /></label><label>Hạn chọn ảnh<input name="selectionDeadline" type="datetime-local" /></label></div><label>Ghi chú <span className="optional">(không bắt buộc)</span><textarea name="notes" rows={3} placeholder="Tên trường, lớp, job…" /></label><button className="primary" disabled={busy || !driveConfig?.configured}>{busy ? 'Đang import…' : 'Kết nối Drive & import ảnh'}</button><p className="form-note">Quét cả thư mục con. Token Google chỉ tồn tại trong tab trình duyệt và không lưu vào D1.</p></form></section><section className="panel table-panel"><div className="panel-heading"><div><span className="section-label">DANH SÁCH</span><h2>Album</h2></div><button className="ghost small-button" onClick={() => void load()} disabled={loading}>Làm mới</button></div>{loading ? <div className="empty-state">Đang tải album…</div> : projects.length === 0 ? <div className="empty-state">Chưa có album. Dán folder Drive ở khung bên trái để tạo album đầu tiên.</div> : <div className="project-list">{projects.map((project) => <article className="project-row" key={project.projectId}><div><strong>{project.projectName}</strong><span>{project.imageCount.toLocaleString('vi-VN')} ảnh · {project.studentCount} học sinh</span></div><span className={`status-badge status-${project.status.toLowerCase()}`}>{project.status}</span></article>)}</div>}</section></div></> : null}
  </div></main>;
}

function CustomerDashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  return <main className="app-shell"><header className="topbar"><Brand /><div className="topbar-right"><div className="signed-in"><span>KHÁCH HÀNG</span><strong>{session.user.displayName}</strong></div><button className="ghost" onClick={onLogout}>Đăng xuất</button></div></header><div className="page-wrap customer-page"><span className="pill">ALBUM CỦA BẠN</span><h1>{session.activeProject?.projectName ?? 'Chưa được gán album'}</h1><p>{session.activeProject ? 'Album đã được gán. Gallery chọn ảnh sẽ được bật ở Phase 4.' : 'Studio chưa gán album cho tài khoản này.'}</p>{session.activeProject ? <div className="alert success">Trạng thái album: {session.activeProject.status}</div> : null}</div></main>;
}

export function App() {
  const [booting, setBooting] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const setup = await api<{ needsSetup: boolean }>('/setup/status');
        if (!active) return;
        setNeedsSetup(setup.needsSetup);
        if (!setup.needsSetup) {
          try { const current = await api<Session>('/me'); if (active) setSession(current); } catch { /* login screen */ }
        }
      } finally { if (active) setBooting(false); }
    })();
    return () => { active = false; };
  }, []);

  async function logout() {
    if (!session) return;
    try { await api('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken }, body: '{}' }); } finally { setSession(null); setNeedsSetup(false); }
  }

  if (booting) return <LoadingScreen />;
  if (needsSetup && !session) return <SetupScreen onReady={(ready) => { setSession(ready); setNeedsSetup(false); }} />;
  if (!session) return <LoginScreen onLogin={setSession} />;
  if (session.user.role === 'ADMIN') return <AdminDashboard session={session} onLogout={() => void logout()} />;
  return <CustomerDashboard session={session} onLogout={() => void logout()} />;
}
