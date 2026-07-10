import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const base = process.env.GRUNTEND_EXAMPLE_BASE_PATH ?? "";

const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
  kit: {
    adapter: adapter(),
    experimental: {
      remoteFunctions: true,
    },
    paths: {
      base,
    },
  },
};

export default config;
