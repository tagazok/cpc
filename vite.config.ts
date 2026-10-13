import { defineConfig } from "vite";

// Served from GitHub Pages at https://tagazok.github.io/cpc/ , so assets must
// resolve under the /cpc/ sub-path. The spot feed is now fetched directly from
// a keyless, CORS-enabled CDN (see src/spot.ts), so no dev-server proxy is
// needed -- the app is fully static and runs the same locally and on Pages.
export default defineConfig({
  base: "/cpc/",
  server: { port: 5174 },
  preview: { port: 4175 },
});
