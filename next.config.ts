import type { NextConfig } from "next";
import dns from "node:dns";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {
  // ignore
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
