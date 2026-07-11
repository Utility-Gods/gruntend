import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://gruntend.com",
  devToolbar: { enabled: false },
  integrations: [
    starlight({
      title: "Gruntend",
      description:
        "A semantic application runtime for safe, capability-driven AI orchestration.",
      customCss: ["./src/styles/custom.css"],
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
          label: "Start here",
          items: [
            { label: "What Gruntend is", slug: "index" },
            { label: "Why code plans", slug: "code-plan-format" },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "Expose application capabilities",
              slug: "guides/expose-capabilities",
            },
            {
              label: "Run a plan through app handlers",
              slug: "guides/run-a-plan",
            },
            {
              label: "Generate task-specific UI",
              slug: "guides/generated-ui",
            },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Tools and handlers", slug: "reference/tools" },
            { label: "Generated UI", slug: "reference/generated-ui" },
          ],
        },
      ],
    }),
  ],
});
