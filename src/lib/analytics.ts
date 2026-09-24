export type AnalyticsEventName =
  | 'page_view'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'report_exported'
  | 'cta_clicked'
  | 'contact_started'
  | 'contact_submitted'
  | 'finding_reboot'
  | 'finding_anr'
  | 'finding_crash'
  | 'finding_kernel'
  | 'finding_biometric'
  | 'finding_display'
  | 'finding_thermal'
  | 'finding_boot';

const VISITOR_KEY = 'dd.visitor.v1';
const SESSION_KEY = 'dd.session.v1';

function getOrCreate(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  storage.setItem(key, created);
  return created;
}

export function getVisitorId(): string {
  return getOrCreate(localStorage, VISITOR_KEY);
}

export function getSessionId(): string {
  return getOrCreate(sessionStorage, SESSION_KEY);
}

export async function track(
  event: AnalyticsEventName,
  options: { category?: string; durationMs?: number; count?: number } = {},
): Promise<void> {
  if (typeof window === 'undefined') return;
  const payload = {
    event,
    path: window.location.pathname,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    referrer: document.referrer,
    category: options.category ?? '',
    durationMs: options.durationMs ?? 0,
    count: options.count ?? 1,
  };

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const accepted = navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
      if (accepted) return;
    }
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt the product flow.
  }
}
