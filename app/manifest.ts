import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flytt.io",
    short_name: "Flytt",
    description:
      "Flyttanmälan, checklista och smart flytthjälp i en lugnare digital upplevelse.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#1A1A2E",
    lang: "sv-SE",
    icons: [
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
