export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Fix 1: Node.js dns module prefer IPv4
      const dns = require("node:dns");
      dns.setDefaultResultOrder("ipv4first");

      // Fix 2: undici (native fetch engine) uses its own DNS resolver.
      // Force it to always resolve to IPv4 by overriding the global dispatcher.
      const { setGlobalDispatcher, Agent } = require("undici");
      setGlobalDispatcher(
        new Agent({
          connect: {
            lookup: (
              hostname: string,
              options: { family?: number; hints?: number; all?: boolean },
              callback: (
                err: NodeJS.ErrnoException | null,
                address: string,
                family: number
              ) => void
            ) => {
              dns.lookup(hostname, { ...options, family: 4 }, callback);
            },
          },
        })
      );
    } catch (e) {
      // ignore — will gracefully degrade
    }
  }
}
