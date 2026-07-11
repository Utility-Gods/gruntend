import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://gruntend.com",
  devToolbar: { enabled: false },
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      wrap: true,
    },
  },
  integrations: [
    starlight({
      title: "Gruntend",
      description:
        "A semantic application runtime for safe, capability-driven AI orchestration.",
      customCss: ["./src/styles/custom.css"],
      expressiveCode: false,
      components: {
        Header: "./src/components/Header.astro",
        Hero: "./src/components/Hero.astro",
        Footer: "./src/components/Footer.astro",
        Head: "./src/components/Head.astro",
        ThemeProvider: "./src/components/LightTheme.astro",
        ThemeSelect: "./src/components/Empty.astro",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/Utility-Gods/gruntend",
        },
      ],
      sidebar: [
        {
          label: "Learn",
          items: [
            { label: "How it works", slug: "overview" },
            { label: "First task", slug: "getting-started" },
            { label: "Code plans", slug: "code-plan-format" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Generated UI", slug: "guides/generated-ui" },
            { label: "Framework adapters", slug: "guides/framework-adapters" },
          ],
        },
        {
          label: "Reference",
          items: [{ label: "API", slug: "reference/api" }],
        },
      ],
    }),
  ],
});
