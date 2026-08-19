import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

type Role = 'ADMIN' | 'CUSTOMER';

type ActiveProject = {
  projectId: string;
  projectName: string;
  status: string;
};

type Session = {
  user: {
    userId: string;
    username: string;
    displayName: string;
    role: Role;
  };
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

type IssuedCredential = {
  title: string;
  username: string;
  password: string;
};

type ApiErrorBody = { error?: { message?: string } };

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">S</div>
      <div>
        <strong>SMILE MEDIA</strong>
        <span>Photo Selector</span>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="auth-shell">
      <section className="auth-card loading-card">
        <Brand />
        <div className="loader" />
        <p>Đang kết nối hệ thống…</p>
      </section>
    </main>
  );
}

function SetupScreen({ onReady }: { onReady: (session: Session) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    if (password !== confirm) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setBusy(true);
    try {
      const session = await api<Session>('/setup/admin', {
        method: 'POST',
        body: JSON.stringify({
          username: String(form.get('username') ?? ''),
          displayName: String(form.get('displayName') ?? ''),
          email: String(form.get('email') ?? ''),
          password,
        }),
      });
      onReady(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tạo ADMIN.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card wide-auth">
        <Brand />
        <div className="auth-heading">
          <span className="pill">THIẾT LẬP LẦN ĐẦU</span>
          <h1>Tạo tài khoản quản trị</h1>
          <p>Form này chỉ hoạt động khi hệ thống chưa có ADMIN. Tạo xong sẽ tự khóa vĩnh viễn.</p>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label>
            Tên đăng nhập
            <input name="username" autoComplete="username" required minLength={3} placeholder="smileadmin" />
          </label>
          <label>
            Tên hiển thị
            <input name="displayName" required placeholder="SMILE MEDIA Admin" />
          </label>
          <label className="full-field">
            Email <span className="optional">(không bắt buộc)</span>
            <input name="email" type="email" autoComplete="email" placeholder="studio@example.com" />
          </label>
          <label>
            Mật khẩu
            <input name="password" type="password" autoComplete="new-password" required minLength={10} />
          </label>
          <label>
            Nhập lại mật khẩu
            <input name="confirm" type="password" autoComplete="new-password" required minLength={10} />
          </label>
          {error ? <div className="alert error full-field">{error}</div> : null}
          <button className="primary full-field" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo ADMIN và vào hệ thống'}</button>
        </form>
      </section>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = await api<Session>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: String(form.get('username') ?? ''),
          password: String(form.get('password') ?? ''),
        }),
      });
      onLogin(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Brand />
        <div className="auth-heading">
          <span className="pill">V1 · PHASE 2</span>
          <h1>Đăng nhập</h1>
          <p>Khách hàng dùng đúng tài khoản và mật khẩu do studio cấp.</p>
        </div>
        <form className="stack-form" onSubmit={submit}>
          <label>Tên đăng nhập<input name="username" autoComplete="username" required autoFocus /></label>
          <label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required /></label>
          {error ? <div className="alert error">{error}</div> : null}
          <button className="primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
      </section>
    </main>
  );
}

function IssuedPanel({ credential, onClose }: { credential: IssuedCredential; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(`Tài khoản: ${credential.username}\nMật khẩu: ${credential.password}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="issued-panel">
      <div>
        <span className="pill warning-pill">CHỈ HIỆN LẦN NÀY</span>
        <h3>{credential.title}</h3>
        <p>Gửi thông tin này cho khách trước khi đóng. Hệ thống không lưu mật khẩu dạng đọc được.</p>
      </div>
      <div className="credential-box"><span>Tài khoản</span><strong>{credential.username}</strong></div>
      <div className="credential-box"><span>Mật khẩu</span><strong>{credential.password}</strong></div>
      <div className="button-row">
        <button className="primary" onClick={() => void copy()}>{copied ? 'Đã sao chép' : 'Sao chép tài khoản + mật khẩu'}</button>
        <button className="ghost" onClick={onClose}>Đã lưu, đóng</button>
      </div>
    </div>
  );
}

function AdminDashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<IssuedCredential | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [usersResult, projectsResult] = await Promise.all([
        api<{ users: AdminUser[] }>('/admin/users'),
        api<{ projects: AdminProject[] }>('/admin/projects'),
      ]);
      setUsers(usersResult.users);
      setProjects(projectsResult.projects);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu quản trị.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const result = await api<{ user: AdminUser; issuedPassword: string }>('/admin/users', {
        method: 'POST',
        headers: { 'X-CSRF-Token': session.csrfToken },
        body: JSON.stringify({
          username: String(form.get('username') ?? ''),
          displayName: String(form.get('displayName') ?? ''),
          email: String(form.get('email') ?? ''),
        }),
      });
      setIssued({ title: 'Tài khoản khách vừa tạo', username: result.user.username, password: result.issuedPassword });
      formElement.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tạo được tài khoản.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(user: AdminUser) {
    if (!window.confirm(`Cấp mật khẩu mới cho ${user.displayName}? Tất cả phiên đăng nhập cũ sẽ bị đăng xuất.`)) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ username: string; issuedPassword: string }>(`/admin/users/${user.userId}/reset-password`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': session.csrfToken },
        body: JSON.stringify({}),
      });
      setIssued({ title: `Mật khẩu mới · ${user.displayName}`, username: result.username, password: result.issuedPassword });
      setMessage('Đã reset mật khẩu và thu hồi toàn bộ phiên đăng nhập cũ.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không reset được mật khẩu.');
    } finally {
      setBusy(false);
    }
  }

  async function assignProject(user: AdminUser, value: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/admin/users/${user.userId}/assign-project`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': session.csrfToken },
        body: JSON.stringify({ projectId: value || null }),
      });
      setMessage(value ? `Đã gán album cho ${user.displayName}.` : `Đã hủy gán album của ${user.displayName}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thay đổi được album.');
    } finally {
      setBusy(false);
    }
  }

  const customers = users.filter((user) => user.role === 'CUSTOMER');
  const assignableProjects = projects.filter((project) => project.assignable);

  return (
    <main className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <div className="signed-in"><span>ADMIN</span><strong>{session.user.displayName}</strong></div>
          <button className="ghost" onClick={onLogout}>Đăng xuất</button>
        </div>
      </header>

      <div className="page-wrap">
        <section className="hero-row">
          <div><span className="pill">QUẢN TRỊ</span><h1>Tài khoản khách hàng</h1><p>Tạo tài khoản, cấp lại mật khẩu và quản lý album ACTIVE của từng khách.</p></div>
          <div className="stat-card"><span>Khách hàng</span><strong>{customers.length}</strong><small>{projects.length} album trong hệ thống</small></div>
        </section>

        {issued ? <IssuedPanel credential={issued} onClose={() => setIssued(null)} /> : null}
        {error ? <div className="alert error">{error}</div> : null}
        {message ? <div className="alert success">{message}</div> : null}

        <div className="admin-grid">
          <section className="panel">
            <div className="panel-heading"><div><span className="section-label">TẠO MỚI</span><h2>Cấp tài khoản khách</h2></div></div>
            <form className="stack-form compact" onSubmit={createCustomer}>
              <label>Tên khách / lớp<input name="displayName" required placeholder="Nguyễn Văn A · 12A1" /></label>
              <label>Tên đăng nhập<input name="username" required minLength={3} placeholder="12a1.nguyenvana" /></label>
              <label>Email <span className="optional">(không bắt buộc)</span><input name="email" type="email" placeholder="khach@example.com" /></label>
              <button className="primary" disabled={busy}>Tạo tài khoản & cấp mật khẩu</button>
              <p className="form-note">Mật khẩu ngẫu nhiên chỉ được trả về ngay sau khi tạo. Không yêu cầu khách đổi mật khẩu lần đầu.</p>
            </form>
          </section>

          <section className="panel table-panel">
            <div className="panel-heading">
              <div><span className="section-label">DANH SÁCH</span><h2>Khách hàng</h2></div>
              <button className="ghost small-button" onClick={() => void load()} disabled={loading}>Làm mới</button>
            </div>
            {loading ? <div className="empty-state">Đang tải tài khoản…</div> : null}
            {!loading && customers.length === 0 ? <div className="empty-state">Chưa có tài khoản khách. Tạo tài khoản đầu tiên ở khung bên trái.</div> : null}
            {!loading && customers.length > 0 ? (
              <div className="customer-list">
                {customers.map((user) => (
                  <article className="customer-row" key={user.userId}>
                    <div className="customer-main"><strong>{user.displayName}</strong><span>@{user.username}{user.email ? ` · ${user.email}` : ''}</span></div>
                    <div className="assignment">
                      <span>Album đang gán</span>
                      <select
                        value={user.activeProject?.projectId ?? ''}
                        disabled={busy || (assignableProjects.length === 0 && !user.activeProject)}
                        onChange={(event) => void assignProject(user, event.target.value)}
                      >
                        <option value="">Chưa gán album</option>
                        {assignableProjects.map((project) => (
                          <option value={project.projectId} key={project.projectId}>{project.projectName}</option>
                        ))}
                        {user.activeProject && !assignableProjects.some((project) => project.projectId === user.activeProject?.projectId) ? (
                          <option value={user.activeProject.projectId} disabled>{user.activeProject.projectName} · {user.activeProject.status}</option>
                        ) : null}
                      </select>
                      {projects.length === 0 ? <small>Album sẽ xuất hiện ở đây sau Phase 3 · Drive Import.</small> : null}
                    </div>
                    <button className="ghost small-button" disabled={busy} onClick={() => void resetPassword(user)}>Reset mật khẩu</button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function CustomerDashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  return (
    <main className="app-shell">
      <header className="topbar"><Brand /><div className="topbar-right"><div className="signed-in"><span>KHÁCH HÀNG</span><strong>{session.user.displayName}</strong></div><button className="ghost" onClick={onLogout}>Đăng xuất</button></div></header>
      <div className="customer-home">
        <span className="pill">SMILE MEDIA</span>
        <h1>Xin chào, {session.user.displayName}</h1>
        {session.activeProject ? (
          <section className="album-card"><span>ALBUM ĐANG HOẠT ĐỘNG</span><h2>{session.activeProject.projectName}</h2><p>Trạng thái: {session.activeProject.status}</p><button className="primary" disabled>Gallery sẽ mở ở Phase 4</button></section>
        ) : (
          <section className="album-card empty-album"><h2>Chưa có album được gán</h2><p>Studio sẽ gán album cho tài khoản này khi job ảnh sẵn sàng.</p></section>
        )}
      </div>
    </main>
  );
}

export function App() {
  const [booting, setBooting] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [fatal, setFatal] = useState('');

  async function bootstrap() {
    setBooting(true);
    setFatal('');
    try {
      const setup = await api<{ needsSetup: boolean }>('/setup/status');
      setNeedsSetup(setup.needsSetup);
      if (!setup.needsSetup) {
        try {
          const current = await api<Session>('/me');
          setSession(current);
        } catch {
          setSession(null);
        }
      }
    } catch (cause) {
      setFatal(cause instanceof Error ? cause.message : 'Không thể kết nối hệ thống.');
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => { void bootstrap(); }, []);

  async function logout() {
    if (!session) return;
    try {
      await api('/auth/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': session.csrfToken },
        body: JSON.stringify({}),
      });
    } finally {
      setSession(null);
    }
  }

  if (booting) return <LoadingScreen />;
  if (fatal) return <main className="auth-shell"><section className="auth-card"><Brand /><div className="alert error">{fatal}</div><button className="primary" onClick={() => void bootstrap()}>Thử lại</button></section></main>;
  if (needsSetup && !session) return <SetupScreen onReady={(value) => { setNeedsSetup(false); setSession(value); }} />;
  if (!session) return <LoginScreen onLogin={setSession} />;
  if (session.user.role === 'ADMIN') return <AdminDashboard session={session} onLogout={() => void logout()} />;
  return <CustomerDashboard session={session} onLogout={() => void logout()} />;
}
