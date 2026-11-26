import { vitePlugin as remix } from "@remix-run/dev";
import { vercelPreset } from "@vercel/remix/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: false;
  }
}

export default defineConfig({
  server: { port: 5173 },
  plugins: [
    remix({
      // On Vercel (VERCEL=1 during its build) emit Vercel's serverless output.
      // Locally the normal build stays, so `npm start` keeps working.
      presets: process.env.VERCEL ? [vercelPreset()] : [],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
});
