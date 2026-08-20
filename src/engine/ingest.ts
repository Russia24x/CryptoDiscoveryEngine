/**
 * CryptoSieve — Feed Ingestion Engine
 *
 * Fetches and parses feed sources (RSS + Telegram public preview).
 * Pure TypeScript — no external XML parser dependency (hand-rolled for RSS).
 *
 * Telegram: uses the public t.me/s/CHANNEL preview page which renders
 * recent messages as HTML. No API key needed.
 *
 * @see docs/PRD.md §3.3 (Information Layer → Thesis Impact)
 */

export interface IngestedItem {
  externalId: string;
  title: string;
  body?: string;        // full message text (not truncated)
  url?: string;
  publishedAt: Date;
  mediaUrls?: string[];  // image URLs (cdn4.telesco.pe for Telegram)
  hasVideo?: boolean;    // Telegram web preview doesn't expose mp4s
  authorName?: string;   // channel display name
}

export interface IngestResult {
  sourceId: string;
  sourceName: string;
  kind: string;
  items: IngestedItem[];
  error?: string;
}

/** Fetch with timeout, return HTML/text. */
async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "manual", // SSRF: don't auto-follow redirects to internal URLs
      headers: { "User-Agent": "CryptoSieve/1.0 (feed ingester)" },
    });
    // Handle redirects manually: only follow to safe URLs
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        const redirectUrl = new URL(location, url).href;
        // Re-validate the redirect target (same isUrlSafe check)
        if (!isUrlSafeForFetch(redirectUrl)) return null;
        // Follow the redirect manually (one level — no infinite loops)
        const redirectRes = await fetch(redirectUrl, {
          signal: ctrl.signal,
          redirect: "manual",
          headers: { "User-Agent": "CryptoSieve/1.0 (feed ingester)" },
        });
        if (!redirectRes.ok && redirectRes.status < 300) return null;
        return await redirectRes.text();
      }
      return null;
    }
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * SSRF protection: validate that a URL is safe to fetch server-side.
 * Blocks: localhost, private IPs, link-local, metadata endpoints.
 * Also handles decimal, hex, and octal IP encodings.
 */
function isUrlSafeForFetch(urlStr: string): boolean {
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
    const v4MappedMatch = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (v4MappedMatch) {
      const g1 = v4MappedMatch[1].padStart(4, "0");
      const g2 = v4MappedMatch[2].padStart(4, "0");
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

// ─── RSS Parser (hand-rolled, no external dep) ───────────────────

function extractTag(xml: string, tag: string): string {
  // Match <tag>...</tag> or <tag attr="...">...</tag>, first occurrence.
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    // Decode named HTML entities (common + directional/formatting)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Directional / formatting entities (Telegram uses &rlm; heavily for RTL text)
    .replace(/&rlm;/g, "\u200F")   // Right-to-Left Mark
    .replace(/&lrm;/g, "\u200E")   // Left-to-Right Mark
    .replace(/&rle;/g, "\u202B")   // Right-to-Left Embedding
    .replace(/&lre;/g, "\u202A")   // Left-to-Right Embedding
    .replace(/&rlo;/g, "\u202E")   // Right-to-Left Override
    .replace(/&lro;/g, "\u202D")   // Left-to-Right Override
    .replace(/&zwj;/g, "\u200D")   // Zero Width Joiner
    .replace(/&zwnj;/g, "\u200C")  // Zero Width Non-Joiner
    // Decode numeric HTML entities (decimal: &#8207; and hex: &#x200F;)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .trim();
}

export function parseRss(xml: string): IngestedItem[] {
  const items: IngestedItem[] = [];
  // RSS 2.0: <item> elements inside <channel>
  const itemXmls = extractAllTags(xml, "item");
  for (const itemXml of itemXmls.slice(0, 20)) {
    const title = stripHtml(extractTag(itemXml, "title"));
    const link = stripHtml(extractTag(itemXml, "link"));
    const description = stripHtml(extractTag(itemXml, "description"));
    // Get full content from content:encoded (has full article text + images)
    const contentEncoded = extractTag(itemXml, "content:encoded");
    const fullContent = contentEncoded ? stripHtml(contentEncoded) : description;
    // Extract images from media:content, enclosure, or content:encoded
    const mediaUrls: string[] = [];
    // media:content url="..."
    const mediaMatches = itemXml.matchAll(/<media:content[^>]+url="([^"]+)"/gi);
    for (const m of mediaMatches) {
      if (m[1] && /\.(jpg|jpeg|png|gif|webp)/i.test(m[1])) mediaUrls.push(m[1]);
    }
    // enclosure url="..." (type="image/...")
    const enclosureMatches = itemXml.matchAll(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/gi);
    for (const m of enclosureMatches) {
      if (m[1]) mediaUrls.push(m[1]);
    }
    // <img src="..."> inside content:encoded
    if (contentEncoded) {
      const imgMatches = contentEncoded.matchAll(/<img[^>]+src=["']([^"']+)/gi);
      for (const m of imgMatches) {
        if (m[1] && !mediaUrls.includes(m[1])) mediaUrls.push(m[1]);
      }
    }
    const pubDateStr = extractTag(itemXml, "pubDate");
    const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();
    if (isNaN(pubDate.getTime())) continue;
    const externalId = link || title || pubDate.toISOString();
    items.push({
      externalId,
      title: title || "(untitled)",
      body: fullContent || undefined, // full content, no truncation
      url: link || undefined,
      publishedAt: pubDate,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls.slice(0, 5) : undefined, // up to 5 images
    });
  }
  return items;
}

// ─── Telegram Parser ──────────────────────────────────────────────

/** Extract the channel name from a t.me URL. */
export function telegramChannelName(address: string): string | null {
  // Accept: https://t.me/channel, t.me/channel, https://t.me/s/channel, @channel
  const m = address
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\/(s\/)?/i, "")
    .replace(/^\/+/, "")
    .replace(/\/.*$/, "")
    .trim();
  return m || null;
}

/**
 * Parse the public t.me/s/CHANNEL preview HTML.
 * Telegram's preview renders messages in .tgme_widget_message elements.
 * Extracts: full message text, images (background-image:url), video presence,
 * author name, datetime, and post link.
 */
export function parseTelegram(html: string): IngestedItem[] {
  const items: IngestedItem[] = [];
  // Split by message wrapper. Each block starts with a class attr.
  const messageBlocks = html.split(/class="tgme_widget_message /).slice(1);
  for (const block of messageBlocks.slice(0, 20)) {
    // Extract FULL message text. The text div contains nested HTML (emoji
    // <i> tags, <br/>, etc.) but NOT nested <div>s — the lazy `*?</div>`
    // was truncating at the first closing tag. The message text section
    // ends right before the next tgme_widget_message_* element (photo,
    // video, link preview, footer, etc.), so we match to that boundary.
    const textMatch = block.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<div class="tgme_widget_message_(?:photo|video|link|reply|footer|views|date|author|bubble|not_supported|service)/i,
    );
    // Fallback: if no following section, match to end of bubble div
    const rawText = textMatch
      ? textMatch[1]
      : (block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? "");
    // Extract datetime
    const timeMatch = block.match(/datetime="([^"]+)"/i);
    // Extract post link
    const linkMatch = block.match(/class="tgme_widget_message_date"[^>]*href="([^"]+)"/i);
    // Extract author name
    const authorMatch = block.match(
      /class="tgme_widget_message_owner_name"[^>]*><span[^>]*>([^<]+)<\/span>/i,
    );
    // Extract all image URLs from background-image:url('...') in photo_wrap elements
    const photoMatches = block.matchAll(
      /class="tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/gi,
    );
    const mediaUrls: string[] = [];
    for (const m of photoMatches) {
      if (m[1]) mediaUrls.push(m[1]);
    }
    // Detect video presence (Telegram web preview marks as not_supported but
    // we know a video exists). The actual mp4 isn't exposed without the app.
    const hasVideo = /tgme_widget_message_video/.test(block);

    const fullText = stripHtml(rawText);
    // Skip if no text AND no media (pure system message or empty)
    if (!fullText && mediaUrls.length === 0 && !hasVideo) continue;

    const publishedAt = timeMatch ? new Date(timeMatch[1]) : new Date();
    if (isNaN(publishedAt.getTime())) continue;

    const url = linkMatch ? linkMatch[1] : undefined;
    const externalId = url || `${publishedAt.getTime()}-${fullText.slice(0, 20)}`;

    items.push({
      externalId,
      title: fullText.slice(0, 140) + (fullText.length > 140 ? "…" : ""),
      body: fullText || undefined, // full text, no truncation
      url,
      publishedAt,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      hasVideo: hasVideo || undefined,
      authorName: authorMatch?.[1]?.trim() || undefined,
    });
  }
  return items;
}

// ─── Dispatcher ──────────────────────────────────────────────────

export async function ingestSource(
  kind: string,
  address: string,
): Promise<IngestedItem[]> {
  if (kind === "rss") {
    const xml = await fetchText(address);
    if (!xml) return [];
    return parseRss(xml);
  }

  if (kind === "telegram") {
    const channel = telegramChannelName(address);
    if (!channel) return [];
    // The /s/ prefix renders the public message preview page.
    const url = `https://t.me/s/${channel}`;
    const html = await fetchText(url);
    if (!html) return [];
    return parseTelegram(html);
  }

  // X/Twitter: requires API key (paid). Not ingested in free-first mode.
  if (kind === "x") {
    return [];
  }

  return [];
}
