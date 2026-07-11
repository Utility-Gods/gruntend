import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://gruntend.com",
  integrations: [
    starlight({
      title: "Gruntend",
      description:
        "A semantic application runtime for safe, capability-driven AI orchestration.",
      logo: {
        replacesTitle: true,
        src: "./src/assets/gruntend-logo.svg",
      },
      customCss: ["./src/styles/custom.css"],
      social: {
        github: "https://github.com/Utility-Gods/gruntend",
      },
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "What Gruntend is", slug: "index" },
            { label: "The code plan format", slug: "code-plan-format" },
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
