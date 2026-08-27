/**
 * Shared SSRF protection: validate that a URL is safe to fetch server-side.
 *
 * Single source of truth for ALL outbound user-influenced fetches.
 * Used by: feed ingestion (engine/ingest.ts), feed source creation
 * (api/feeds/route.ts), and any future outbound fetch of user-provided URLs.
 *
 * Blocks: localhost, private IPs (10/8, 172.16/12, 192.168/16), link-local
 * & cloud metadata (169.254/16), loopback (127/8), reserved (0/8), IPv6
 * loopback/link-local/ULA, IPv4-mapped IPv6 bypasses (including the
 * non-zero-padded hex form Node produces), and non-http(s) schemes.
 * Handles decimal, hex, and octal IPv4 encodings.
 *
 * NOTE: hostname-based checks cannot stop DNS rebinding (a public hostname
 * resolving to a private IP). If this app ever runs in a hostile
 * multi-tenant environment, add DNS-resolution pinning at the fetch layer.
 */

export function isUrlSafeForFetch(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

    // Block literal hostnames
    if (host === "localhost" || host === "0.0.0.0") return false;

    // Try to parse as IP — handle decimal, hex, octal encodings
    // Node's URL already normalizes some of these, but let's be thorough
    let ip: number[] | null = null;
    const parts = host.split(".");
    if (parts.length === 4) {
      ip = parts.map(p => parseInt(p, 10));
      // Check if any part was parsed as NaN (could be hex like 0x7f000001)
      if (ip.some(isNaN)) {
        // Try hex parsing for each part
        ip = parts.map(p => p.startsWith("0x") ? parseInt(p, 16) : NaN);
        if (ip.some(isNaN)) ip = null;
      }
    }

    if (ip && ip.every(o => o >= 0 && o <= 255)) {
      const [a, b] = ip;
      // 127.x.x.x (loopback)
      if (a === 127) return false;
      // 10.x.x.x (private class A)
      if (a === 10) return false;
      // 172.16-31.x.x (private class B)
      if (a === 172 && b >= 16 && b <= 31) return false;
      // 192.168.x.x (private class C)
      if (a === 192 && b === 168) return false;
      // 169.254.x.x (link-local / metadata)
      if (a === 169 && b === 254) return false;
      // 0.x.x.x (reserved)
      if (a === 0) return false;
    }

    // Block IPv6 loopback, link-local, and IPv4-mapped IPv6 bypasses
    // Node normalizes ::ffff:127.0.0.1 to ::ffff:7f00:1 (hex, not dotted-decimal)
    if (host === "::1") return false;
    // Check for IPv4-mapped IPv6 (::ffff:xxxx:xxxx)
    // CRITICAL: hex groups are NOT zero-padded by Node. "10.0.0.1" → "::ffff:a00:1"
    // NOT "::ffff:0a00:0001". Must padStart(4,"0") before slicing.
    const v4MappedMatch = host.match(/^::ffff:([0-9a-f]{1,4}):(?:[0-9a-f]{1,4})$/i);
    if (v4MappedMatch) {
      const g1 = v4MappedMatch[1].padStart(4, "0");
      const a = parseInt(g1.slice(0, 2), 16);
      const b = parseInt(g1.slice(2, 4), 16);
      if (a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0) return false;
    }
    // Also check the dotted-decimal form that some Node versions keep
    if (host.startsWith("::ffff:")) {
      const v4Part = host.slice(7); // extract the x.x.x.x part
      const v4Parts = v4Part.split(".");
      if (v4Parts.length === 4) {
        const nums = v4Parts.map(p => parseInt(p, 10));
        if (nums.every(n => n >= 0 && n <= 255)) {
          const [a, b] = nums;
          if (a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0) return false;
        }
      }
    }
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false;

    // Block known metadata endpoints
    if (host === "metadata.google.internal") return false;

    return true;
  } catch {
    return false;
  }
}
