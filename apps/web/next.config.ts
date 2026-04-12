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
  ],
  serverExternalPackages: [
    "googleapis",
    "@google/generative-ai",
    "@breezystack/lamejs",
  ],
};

export default nextConfig;
