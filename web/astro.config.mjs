import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://diffle.dev",
  integrations: [
    starlight({
      title: "diffle",
      description: "Local git diff review with inline comments and structured feedback for coding agents.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/codywilliamson/diffle" }],
      customCss: ["./src/styles/diffle.css"],
      sidebar: [
        { label: "Getting started", items: [{ autogenerate: { directory: "getting-started" } }] },
        { label: "Guides", items: [{ autogenerate: { directory: "guides" } }] },
        { label: "Reference", items: [{ autogenerate: { directory: "reference" } }] },
      ],
    }),
  ],
});
