import type { NextConfig } from "next";
import dns from "node:dns";
import { setGlobalDispatcher, Agent } from "undici";

try {
  dns.setDefaultResultOrder("ipv4first");
  setGlobalDispatcher(
    new Agent({
      connect: {
        lookup: (hostname: string, options: any, callback: any) => {
          dns.lookup(hostname, { ...options, family: 4 }, callback);
        },
      },
    })
  );
} catch (e) {
  // ignore
}


const nextConfig: NextConfig = {
  serverExternalPackages: ["googleapis", "google-auth-library", "undici"],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;

