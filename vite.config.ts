import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    prerender: {
      enabled: true,
      failOnError: false,
      autoStaticPathsDiscovery: true,
      crawlLinks: true,
      filter: ({ path }: { path: string }) => {
        // Skip routes that need server-side params or auth before login
        // (they still hydrate and fetch data at runtime via the Laravel API).
        if (path.includes('$')) return false;
        const skipPrefixes = ['/admin', '/dashboard', '/account', '/apply', '/payment', '/receipt', '/verify', '/certificate'];
        if (skipPrefixes.some((p) => path.startsWith(p))) return false;
        return true;
      },
    },
  },
});