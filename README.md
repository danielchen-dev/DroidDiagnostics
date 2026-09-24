# DroidDiagnostics MVP v0.1.0

Privacy-first Android/AOSP diagnostic triage website. Android bugreport archives and text logs are analyzed in the browser with a Web Worker; source diagnostic content is not uploaded to the application backend.

## What is implemented

- Astro static SEO site with React interactive islands.
- Browser-side ZIP/text diagnostic loading.
- Modular analyzers for reboot, ANR, Java/native crash, kernel, biometric/UDFPS, display, thermal, and boot failures.
- Standard findings with severity, confidence, evidence, related findings, recommended checks, and timeline events.
- Plain-text report export.
- Eight symptom-focused SEO analyzer landing pages.
- Eight technical guide pages and six error-reference pages.
- Anonymous first-party event analytics through Cloudflare Workers Analytics Engine.
- Anonymous browser visitor/session IDs; raw IP is not written by the application. A daily HMAC network identifier can be generated for approximate unique-network counts.
- Admin dashboard with signed HttpOnly session cookie and Analytics Engine SQL queries.
- D1-backed engineering review requests.
- Optional Cloudflare Turnstile verification.
- Sitemap, robots.txt, canonical metadata, Open Graph metadata, and JSON-LD.

## Local development

Requirements: Node.js 22+.

```bash
npm install
npm run dev
```

`npm run dev` runs the static Astro site. API endpoints require the Cloudflare Worker runtime.

To run the complete application locally:

```bash
cp .dev.vars.example .dev.vars
npm run build
npx wrangler d1 migrations apply droiddiagnostics --local
npx wrangler dev
```

Workers Analytics Engine may not produce useful local analytics data. Product behavior is designed to continue even if analytics writes are unavailable during local development.

## Cloudflare setup

### 1. Create D1

```bash
npx wrangler d1 create droiddiagnostics
```

Copy the returned database ID into `wrangler.jsonc` and replace the all-zero placeholder database ID.

Apply the schema:

```bash
npx wrangler d1 migrations apply droiddiagnostics --remote
```

### 2. Configure secrets

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SECRET
npx wrangler secret put ANALYTICS_HMAC_SECRET
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put ANALYTICS_API_TOKEN
```

`ANALYTICS_API_TOKEN` should have the minimum Cloudflare account permission needed to read Analytics Engine data. Keep it server-side only.

Optional Turnstile secret:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Set the matching public site key at Astro build time:

```bash
PUBLIC_TURNSTILE_SITE_KEY=... npm run build
```

### 3. Set the real public URL before production build

Canonical URLs and the generated sitemap depend on `SITE_URL` during the Astro build.

```bash
SITE_URL=https://your-real-domain.example npm run build
npx wrangler deploy
```

Also update `SITE_URL` in `wrangler.jsonc` for runtime configuration.

Do not deploy with `droiddiagnostics.example.com` as the canonical URL.


### 4. Search engine verification

Set the optional build-time variables below, then rebuild and deploy:

```bash
PUBLIC_GOOGLE_SITE_VERIFICATION=... \
PUBLIC_BING_SITE_VERIFICATION=... \
SITE_URL=https://your-real-domain.example npm run build
```

After deployment, submit the generated sitemap to Google Search Console and Bing Webmaster Tools.

## Analytics schema

Workers Analytics Engine dataset: `droiddiagnostics_events`.

- `index1`: anonymous visitor ID
- `blob1`: event name
- `blob2`: page path
- `blob3`: anonymous session ID
- `blob4`: referrer hostname
- `blob5`: country code from Cloudflare request metadata
- `blob6`: diagnostic category
- `blob7`: daily HMAC network identifier
- `double1`: duration in milliseconds
- `double2`: event count/value

The application does not send diagnostic file contents, filenames, evidence lines, or extracted device metadata to the analytics endpoint.

## Admin dashboard

Open `/admin`. The page is `noindex` and the metrics API requires a signed HttpOnly admin session. The password is stored only as the Cloudflare `ADMIN_PASSWORD` secret.

For a public production deployment, Cloudflare Access in front of `/admin*` is an additional defense layer worth enabling.

## Analyzer design

```text
File / ZIP
   ↓
Browser Web Worker
   ↓
Source loader
   ↓
Metadata parser + indexed lines
   ↓
Independent subsystem analyzers
   ↓
Correlation engine
   ↓
Findings + timeline
   ↓
UI / TXT report
```

Each analyzer returns the same `Finding` contract. New analyzers can be added under `src/engine/analyzers` and registered in `src/engine/engine.ts`.

## Important MVP limits

- Signature matching is deterministic triage, not automatic proof of root cause.
- ZIP reading is browser-memory bounded; very large archives can be truncated.
- Native addresses are not symbolized in v0.1.
- Vendor-specific reboot reason mappings are not yet normalized.
- The analyzer currently targets English log signatures.
- No user accounts, subscriptions, payments, LLM calls, or cloud bugreport storage are included.

## Quality commands

```bash
npm run test
npm run check
npm run build
```
