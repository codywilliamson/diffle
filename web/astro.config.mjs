import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const fontHref =
  "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap";

// https://astro.build/config
export default defineConfig({
  site: "https://diffle.dev",
  integrations: [
    starlight({
      title: "diffle",
      description: "Local git diff review with inline comments and structured feedback for coding agents.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/codywilliamson/diffle" }],
      customCss: ["./src/styles/diffle.css"],
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      head: [
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: true } },
        { tag: "link", attrs: { rel: "stylesheet", href: fontHref } },
      ],
      sidebar: [
        { label: "Getting started", items: [{ autogenerate: { directory: "getting-started" } }] },
        { label: "Guides", items: [{ autogenerate: { directory: "guides" } }] },
        { label: "Reference", items: [{ autogenerate: { directory: "reference" } }] },
      ],
    }),
  ],
});
