interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ANALYTICS: AnalyticsEngineDataset;
  SITE_URL: string;
  ANALYTICS_DATASET: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  ANALYTICS_HMAC_SECRET?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  ANALYTICS_API_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
}

interface EventPayload {
  event: string;
  path: string;
  visitorId: string;
  sessionId: string;
  referrer?: string;
  category?: string;
  durationMs?: number;
  count?: number;
}

const EVENT_ALLOWLIST = new Set([
  'page_view', 'analysis_started', 'analysis_completed', 'analysis_failed', 'report_exported',
  'cta_clicked', 'contact_started', 'contact_submitted', 'finding_reboot', 'finding_anr',
  'finding_crash', 'finding_kernel', 'finding_biometric', 'finding_display', 'finding_thermal', 'finding_boot',
]);

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers ?? {}) },
});

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safePath(value: string): string {
  return /^\/[a-zA-Z0-9_\-./]{0,300}$/.test(value) ? value : '/';
}

function safeReferrerHost(value = ''): string {
  if (!value) return '';
  try { return new URL(value).hostname.slice(0, 180); } catch { return ''; }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function dailyNetworkHash(ip: string, secret?: string): Promise<string> {
  if (!ip || !secret) return '';
  const day = new Date().toISOString().slice(0, 10);
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${day}:${ip}`));
  return bytesToBase64Url(new Uint8Array(signature)).slice(0, 32);
}

async function signAdminSession(secret: string): Promise<string> {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifyAdminSession(token: string, secret?: string): Promise<boolean> {
  if (!token || !secret) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlToBytes(signature), new TextEncoder().encode(payload));
    if (!valid) return false;
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { exp?: number };
    return typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

async function handleEvent(request: Request, env: Env): Promise<Response> {
  let payload: EventPayload;
  try { payload = await request.json() as EventPayload; } catch { return json({ ok: false, error: 'Invalid JSON.' }, { status: 400 }); }
  if (!EVENT_ALLOWLIST.has(payload.event)) return json({ ok: false, error: 'Unsupported event.' }, { status: 400 });
  if (!isUuid(payload.visitorId) || !isUuid(payload.sessionId)) return json({ ok: false, error: 'Invalid anonymous identifiers.' }, { status: 400 });

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const networkHash = await dailyNetworkHash(ip, env.ANALYTICS_HMAC_SECRET);
  const country = String(request.cf?.country ?? '').slice(0, 8);

  try {
    env.ANALYTICS.writeDataPoint({
      indexes: [payload.visitorId],
      blobs: [
        payload.event,
        safePath(payload.path),
        payload.sessionId,
        safeReferrerHost(payload.referrer),
        country,
        String(payload.category ?? '').slice(0, 60),
        networkHash,
      ],
      doubles: [
        Number.isFinite(payload.durationMs) ? Math.max(0, Number(payload.durationMs)) : 0,
        Number.isFinite(payload.count) ? Math.max(0, Number(payload.count)) : 1,
      ],
    });
  } catch {
    // Product behavior should not fail when analytics are unavailable in local development.
  }
  return json({ ok: true });
}

async function verifyTurnstile(token: string, secret?: string): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

async function handleContact(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, error: 'Invalid request.' }, { status: 400 });

  const email = String(body.email ?? '').trim().slice(0, 200);
  const company = String(body.company ?? '').trim().slice(0, 160);
  const issueType = String(body.issueType ?? '').trim().slice(0, 100);
  const message = String(body.message ?? '').trim().slice(0, 4000);
  const sourcePage = safePath(String(body.sourcePage ?? '/contact'));
  const visitorId = String(body.visitorId ?? '');
  const turnstileToken = String(body.turnstileToken ?? '');

  if (!/^\S+@\S+\.\S+$/.test(email) || !issueType || message.length < 20) {
    return json({ ok: false, error: 'Please provide a valid email, issue type, and a useful problem description.' }, { status: 400 });
  }
  if (!(await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY))) {
    return json({ ok: false, error: 'Bot verification failed. Please retry.' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(`
      INSERT INTO contacts (id, created_at, email, company, issue_type, message, status, source_page, visitor_id)
      VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)
    `).bind(id, new Date().toISOString(), email, company || null, issueType, message, sourcePage, isUuid(visitorId) ? visitorId : null).run();
  } catch {
    return json({ ok: false, error: 'Contact storage is not configured yet. Apply the D1 migration before accepting requests.' }, { status: 503 });
  }

  return json({ ok: true, id }, { status: 201 });
}

async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return json({ ok: false, error: 'Admin secrets are not configured.' }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { password?: string };
  if (body.password !== env.ADMIN_PASSWORD) return json({ ok: false }, { status: 401 });
  const token = await signAdminSession(env.ADMIN_SESSION_SECRET);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return json({ ok: true }, { headers: { 'set-cookie': `dd_admin=${token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=28800` } });
}

async function queryAnalytics(env: Env, query: string): Promise<Array<Record<string, unknown>>> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) throw new Error('Analytics SQL API credentials are not configured.');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.ANALYTICS_API_TOKEN}`, 'content-type': 'text/plain' },
    body: query,
  });
  if (!response.ok) throw new Error(`Analytics API returned ${response.status}.`);
  const data = await response.json() as { data?: Array<Record<string, unknown>> };
  return data.data ?? [];
}

function safeDataset(value: string): string {
  return /^[A-Za-z0-9_]+$/.test(value) ? value : 'droiddiagnostics_events';
}

function asNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

async function handleAdminMetrics(request: Request, env: Env): Promise<Response> {
  const token = cookieValue(request, 'dd_admin');
  if (!(await verifyAdminSession(token, env.ADMIN_SESSION_SECRET))) return json({ ok: false }, { status: 401 });

  const dataset = safeDataset(env.ANALYTICS_DATASET || 'droiddiagnostics_events');
  let warning = '';
  let summary = { pageViews: 0, visitors: 0, sessions: 0, networks: 0 };
  let events: Array<{ event: string; total: number }> = [];
  let topPages: Array<{ path: string; views: number }> = [];
  let countries: Array<{ country: string; views: number }> = [];
  let referrers: Array<{ referrer: string; views: number }> = [];
  let findings: Array<{ category: string; total: number }> = [];

  try {
    const [summaryRows, eventRows, pageRows, countryRows, referrerRows, findingRows] = await Promise.all([
      queryAnalytics(env, `SELECT count() AS page_views, count(DISTINCT index1) AS visitors, count(DISTINCT blob3) AS sessions, count(DISTINCT blob7) AS networks FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '1' DAY AND blob1 = 'page_view'`),
      queryAnalytics(env, `SELECT blob1 AS event, count() AS total FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '1' DAY AND blob1 IN ('analysis_started','analysis_completed','analysis_failed','report_exported','cta_clicked','contact_started','contact_submitted') GROUP BY event ORDER BY total DESC`),
      queryAnalytics(env, `SELECT blob2 AS path, count() AS views FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '1' DAY AND blob1 = 'page_view' GROUP BY path ORDER BY views DESC LIMIT 10`),
      queryAnalytics(env, `SELECT blob5 AS country, count() AS views FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '1' DAY AND blob1 = 'page_view' GROUP BY country ORDER BY views DESC LIMIT 10`),
      queryAnalytics(env, `SELECT blob4 AS referrer, count() AS views FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '1' DAY AND blob1 = 'page_view' GROUP BY referrer ORDER BY views DESC LIMIT 10`),
      queryAnalytics(env, `SELECT blob6 AS category, count() AS total FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '1' DAY AND blob1 LIKE 'finding_%' GROUP BY category ORDER BY total DESC`),
    ]);
    const row = summaryRows[0] ?? {};
    summary = { pageViews: asNumber(row.page_views), visitors: asNumber(row.visitors), sessions: asNumber(row.sessions), networks: asNumber(row.networks) };
    events = eventRows.map((row) => ({ event: String(row.event ?? ''), total: asNumber(row.total) }));
    topPages = pageRows.map((row) => ({ path: String(row.path ?? ''), views: asNumber(row.views) }));
    countries = countryRows.map((row) => ({ country: String(row.country ?? ''), views: asNumber(row.views) }));
    referrers = referrerRows.map((row) => ({ referrer: String(row.referrer ?? ''), views: asNumber(row.views) }));
    findings = findingRows.map((row) => ({ category: String(row.category ?? ''), total: asNumber(row.total) }));
  } catch (error) {
    warning = error instanceof Error ? error.message : 'Analytics data is not configured yet.';
  }

  let contacts: Array<Record<string, unknown>> = [];
  try {
    const result = await env.DB.prepare(`SELECT id, created_at, email, company, issue_type, message, status, source_page FROM contacts ORDER BY created_at DESC LIMIT 30`).all();
    contacts = result.results ?? [];
  } catch {
    warning = warning || 'D1 contact storage is not configured yet.';
  }

  return json({ configured: !warning, range: '24h', summary, events, topPages, countries, referrers, findings, contacts, warning: warning || undefined });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, service: 'droiddiagnostics', version: '0.1.0' });
  if (request.method === 'POST' && url.pathname === '/api/events') return handleEvent(request, env);
  if (request.method === 'POST' && url.pathname === '/api/contact') return handleContact(request, env);
  if (request.method === 'POST' && url.pathname === '/api/admin/login') return handleAdminLogin(request, env);
  if (request.method === 'GET' && url.pathname === '/api/admin/metrics') return handleAdminMetrics(request, env);
  return json({ ok: false, error: 'Not found.' }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
