import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const site = process.env.SITE_URL ?? 'https://droiddiagnostics.example.com';

export default defineConfig({
  site,
  output: 'static',
  integrations: [
    react(),
    sitemap({ filter: (page) => !page.endsWith('/admin/') && !page.endsWith('/404/') }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      sourcemap: true,
    },
  },
});
