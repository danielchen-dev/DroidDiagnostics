# DroidDiagnostics Release Candidate v1

Apply this cumulative patch on top of droiddiagnostics_mvp_v0.2.0.

## Required checks

1. Configure environment:

ADMIN_PASSWORD
ADMIN_SESSION_SECRET

2. Install dependencies:

npm install

3. Validate:

npm run build

4. Configure Cloudflare:

- Pages deployment
- Worker bindings
- D1 database
- Analytics Engine
- Secrets

5. Deploy:

npx wrangler deploy

## Production checks

- / works
- /analyze works
- /admin/login works
- Admin authentication works
- Contact submission works
- Analytics events arrive
