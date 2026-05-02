import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["duckdb"],
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
