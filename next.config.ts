import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Offering PDFs go up through a server action, and the default cap is 1MB.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
