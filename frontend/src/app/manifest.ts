import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pactiq — Proof-of-Discipline on QIE",
    short_name: "Pactiq",
    description: "Stake QIE on your daily habits. AI-verified check-ins, squads and streak badges.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f2ede3",
    theme_color: "#f2ede3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
