import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["10.1.0.144", "localhost"],
  experimental: {
    serverActions: {
      allowedOrigins: ["10.1.0.144:3000", "localhost:3000"],
    },
  },
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
