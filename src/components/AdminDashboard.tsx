import { useEffect, useState } from 'react';
import './admin.css';

interface Metrics {
  configured: boolean;
  range: string;
  summary: { pageViews: number; visitors: number; sessions: number; networks: number };
  events: Array<{ event: string; total: number }>;
  topPages: Array<{ path: string; views: number }>;
  countries: Array<{ country: string; views: number }>;
  referrers: Array<{ referrer: string; views: number }>;
  findings: Array<{ category: string; total: number }>;
  contacts: Array<{ id: string; created_at: string; email: string; company: string | null; issue_type: string; message: string; status: string; source_page: string }>;
  warning?: string;
}

const emptyMetrics: Metrics = {
  configured: false,
  range: '24h',
  summary: { pageViews: 0, visitors: 0, sessions: 0, networks: 0 },
  events: [], topPages: [], countries: [], referrers: [], findings: [], contacts: [],
};

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/metrics', { credentials: 'same-origin' });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = await response.json() as Metrics & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load analytics.');
      setMetrics(data);
      setAuthenticated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: String(form.get('password') ?? '') }),
      credentials: 'same-origin',
    });
    if (!response.ok) {
      setError('Invalid admin password.');
      return;
    }
    await load();
  };

  if (authenticated === null && loading) return <div className="admin-state">Loading dashboard…</div>;
  if (authenticated === false) {
    return (
      <form className="admin-login card card-pad" onSubmit={login}>
        <span className="kicker">Restricted</span>
        <h2>Admin dashboard</h2>
        <p>Enter the password stored as the Cloudflare Worker secret <code>ADMIN_PASSWORD</code>.</p>
        <input type="password" name="password" autoComplete="current-password" required />
        <button className="button button-primary" type="submit">Sign in</button>
        {error && <p className="form-error">{error}</p>}
      </form>
    );
  }

  const eventValue = (name: string) => metrics.events.find((event) => event.event === name)?.total ?? 0;
  const starts = eventValue('analysis_started');
  const completes = eventValue('analysis_completed');
  const cta = eventValue('cta_clicked');

  return (
    <div className="admin-dashboard">
      <div className="admin-toolbar">
        <div><span className="kicker">Last 24 hours</span><h1>DroidDiagnostics Admin</h1></div>
        <button className="button" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <div className="analysis-error">{error}</div>}
      {metrics.warning && <div className="analysis-warning">{metrics.warning}</div>}

      <section className="metric-grid">
        <Metric label="Visitors" value={metrics.summary.visitors} />
        <Metric label="Page views" value={metrics.summary.pageViews} />
        <Metric label="Sessions" value={metrics.summary.sessions} />
        <Metric label="Unique networks" value={metrics.summary.networks} />
        <Metric label="Analysis starts" value={starts} />
        <Metric label="Completed" value={completes} />
        <Metric label="Completion rate" value={starts ? `${Math.round((completes / starts) * 100)}%` : '—'} />
        <Metric label="Engineering CTA" value={cta} />
      </section>

      <section className="admin-grid-2">
        <DataCard title="Top pages" rows={metrics.topPages.map((row) => [row.path, row.views])} />
        <DataCard title="Countries" rows={metrics.countries.map((row) => [row.country || 'Unknown', row.views])} />
        <DataCard title="Referrers" rows={metrics.referrers.map((row) => [row.referrer || 'Direct / unknown', row.views])} />
        <DataCard title="Findings" rows={metrics.findings.map((row) => [row.category || 'Unknown', row.total])} />
      </section>

      <section className="admin-contacts card">
        <div className="admin-card-title"><h2>Engineering requests</h2><span>{metrics.contacts.length} recent</span></div>
        {metrics.contacts.length === 0 ? <p className="muted">No requests stored yet.</p> : (
          <div className="contact-list">
            {metrics.contacts.map((contact) => (
              <article key={contact.id}>
                <div><strong>{contact.issue_type}</strong><span>{new Date(contact.created_at).toLocaleString()}</span></div>
                <p>{contact.message}</p>
                <small>{contact.email}{contact.company ? ` · ${contact.company}` : ''} · source {contact.source_page}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function DataCard({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <section className="admin-data-card card">
      <div className="admin-card-title"><h2>{title}</h2></div>
      {rows.length === 0 ? <p className="muted">No data yet.</p> : rows.map(([label, value]) => (
        <div className="data-row" key={`${title}-${label}`}><span title={label}>{label}</span><strong>{value}</strong></div>
      ))}
    </section>
  );
}
