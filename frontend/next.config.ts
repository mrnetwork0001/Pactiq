import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (e.g. the local demo next to mainnet) can build into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
