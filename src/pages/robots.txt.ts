import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://droiddiagnostics.danielchen-dev.workers.dev/');
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap-index.xml', base)}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
