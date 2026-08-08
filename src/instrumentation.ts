export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dns = require("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
