import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alışkanlık Takibi",
    short_name: "Alışkanlık",
    description: "Günlük alışkanlık takip sistemi — seri, istatistik, ısı haritası",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F1E9",
    theme_color: "#F4F1E9",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
