import dns from "node:dns";

export function ensureScalevIpv4First() {
  if (
    typeof dns.getDefaultResultOrder !== "function" ||
    typeof dns.setDefaultResultOrder !== "function"
  ) {
    return;
  }

  if (dns.getDefaultResultOrder() !== "ipv4first") {
    dns.setDefaultResultOrder("ipv4first");
  }
}
