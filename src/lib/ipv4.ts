import dns from "node:dns";
import { setGlobalDispatcher, Agent } from "undici";

let initialized = false;

export function initIPv4Enforcement() {
  if (initialized) return;
  initialized = true;

  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch (e) {}

  try {
    setGlobalDispatcher(
      new Agent({
        connect: {
          lookup: (hostname: string, options: any, callback: any) => {
            dns.lookup(hostname, { ...options, family: 4 }, callback);
          },
        },
      })
    );
  } catch (e) {}
}

// Auto-run on module import
initIPv4Enforcement();
