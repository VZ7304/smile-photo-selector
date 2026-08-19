import { useEffect, useState } from 'react';

type HealthResponse = {
  service: string;
  version: string;
  status: 'ok' | 'degraded';
  d1: 'ok' | 'error';
  environment: string;
  timestamp: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/api/v1/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unknown error');
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">SMILE MEDIA</p>
        <h1>Photo Selector V1</h1>
        <p className="muted">Phase 0 / Phase 1 skeleton health gate</p>

        {error ? <div className="bad">API ERROR — {error}</div> : null}
        {!error && !health ? <div className="pending">Checking API + D1…</div> : null}
        {health ? (
          <dl className="grid">
            <div><dt>API</dt><dd>{health.status.toUpperCase()}</dd></div>
            <div><dt>D1</dt><dd>{health.d1.toUpperCase()}</dd></div>
            <div><dt>ENV</dt><dd>{health.environment}</dd></div>
            <div><dt>VERSION</dt><dd>{health.version}</dd></div>
          </dl>
        ) : null}

        {health?.status === 'ok' && health.d1 === 'ok' ? (
          <div className="pass">PASS — Skeleton + health check + D1 are connected.</div>
        ) : null}
      </section>
    </main>
  );
}
