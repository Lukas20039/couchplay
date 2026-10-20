// Schlüssel für IP-basierte Limits: IPv4 exakt, IPv6 auf das /64-Präfix zusammengefasst
// (ein Anschluss erhält typischerweise ein ganzes /64 – sonst wäre jede Adresse ein eigener Bucket).
import { isIPv4, isIPv6 } from "node:net";

function expandIPv6(addr: string): string[] | null {
  const zoneFree = addr.split("%")[0] ?? addr;
  let head: string[];
  let tail: string[];
  if (zoneFree.includes("::")) {
    const [h, t] = zoneFree.split("::");
    head = h ? h.split(":") : [];
    tail = t ? t.split(":") : [];
  } else {
    head = zoneFree.split(":");
    tail = [];
  }
  // Eingebettete IPv4 am Ende (z. B. ::ffff:1.2.3.4) in zwei Hextets umwandeln.
  const last = tail.length ? tail[tail.length - 1] : head[head.length - 1];
  if (last && isIPv4(last)) {
    const parts = last.split(".").map(Number) as [number, number, number, number];
    const hex = [((parts[0] << 8) | parts[1]).toString(16), ((parts[2] << 8) | parts[3]).toString(16)];
    if (tail.length) tail.splice(tail.length - 1, 1, ...hex);
    else head.splice(head.length - 1, 1, ...hex);
  }
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array<string>(missing).fill("0"), ...tail].map((h) => h.toLowerCase().padStart(4, "0"));
}

/** IPv4 (auch IPv4-mapped IPv6) exakt, IPv6 als "<präfix>::/64", sonst unverändert. */
export function ipKey(ip: string): string {
  if (isIPv4(ip)) return ip;
  if (!isIPv6(ip)) return ip;
  const h = expandIPv6(ip);
  if (!h) return ip;
  if (h.slice(0, 5).every((x) => x === "0000") && h[5] === "ffff") {
    const a = parseInt(h[6] ?? "0", 16);
    const b = parseInt(h[7] ?? "0", 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return `${h.slice(0, 4).join(":")}::/64`;
}
