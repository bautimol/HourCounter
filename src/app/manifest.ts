import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HourCounter",
    short_name: "HourCounter",
    description:
      "Tracking de horas, verificación de turnos y cálculo automático de pagos para empleadores informales en Argentina.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf7",
    theme_color: "#059669",
    lang: "es-AR",
    dir: "ltr",
    icons: [
      {
        src: "/icon0",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon1",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
