import { defineConfig } from 'astro/config';

// Every URL ends in a slash, matching the old WordPress site exactly.
export default defineConfig({
  site: 'https://heatpumps-christchurch.co.nz',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
