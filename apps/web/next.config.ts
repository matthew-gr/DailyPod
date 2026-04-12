import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@dailypod/types",
    "@dailypod/core",
    "@dailypod/config",
    "@dailypod/logging",
    "@dailypod/storage",
    "@dailypod/guide",
    "@dailypod/feedback",
    "@dailypod/calendar",
    "@dailypod/audio",
    "@dailypod/editorial",
    "@dailypod/drive",
    "@dailypod/news",
    "@dailypod/meeting-ranker",
    "@dailypod/news-ranker",
    "@dailypod/meeting-context",
  ],
  serverExternalPackages: [
    "googleapis",
    "@google/generative-ai",
    "@breezystack/lamejs",
  ],
  webpack: (config) => {
    // Resolve .js imports to .ts files in workspace packages
    // (packages use Node16 ESM convention: import "./foo.js" → ./foo.ts)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
