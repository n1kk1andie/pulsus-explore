import type { MetadataRoute } from "next";

// The installable app: the same manifest the Play Store wrapper reads.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pulsus Platform · Explore",
    short_name: "Pulsus",
    description: "A free window on the world's sectors, read from public data.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0f2c",
    theme_color: "#0a0f2c",
    categories: ["business", "finance", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
