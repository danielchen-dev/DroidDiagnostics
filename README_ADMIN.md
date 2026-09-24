# Admin v0.3 patch

Added:
- Admin password from environment/Cloudflare secret
- Logout endpoint
- Lead status API preparation

Cloudflare secrets:

wrangler secret put ADMIN_PASSWORD
wrangler secret put ADMIN_SESSION_SECRET
