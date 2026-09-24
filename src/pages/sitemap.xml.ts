import type { APIRoute } from 'astro';

const routes = [
  '/',
  '/analyze',
  '/android-crash-analyzer',
  '/android-anr-analyzer',
  '/android-kernel-panic-analyzer',
  '/android-battery-wakelock-analyzer',
  '/android-fingerprint-log-analyzer',
  '/android-network-log-analyzer',
  '/android-memory-pressure-analyzer',
  '/bugreport-format',
  '/guides',
  '/references',
  '/about',
  '/contact'
];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://droiddiagnostics.danielchen-dev.workers.dev');
  const urls = routes.map((route) => `<url><loc>${new URL(route, base)}</loc></url>`).join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } }
  );
};
