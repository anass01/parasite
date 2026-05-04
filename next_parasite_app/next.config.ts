import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  allowedDevOrigins: ["*", "ridge-definitely-fill-violin.trycloudflare.com", "parasite.vynox.tech"],
};

export default nextConfig;
