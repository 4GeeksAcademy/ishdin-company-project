import type { NextConfig } from "next";

const apiInternalUrl = (
  process.env.API_INTERNAL_URL ?? "http://backend:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
