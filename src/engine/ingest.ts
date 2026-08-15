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
      headers: { "User-Agent": "CryptoSieve/1.0 (feed ingester)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
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
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
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
    const pubDateStr = extractTag(itemXml, "pubDate");
    const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();
    if (isNaN(pubDate.getTime())) continue;
    const externalId = link || title || pubDate.toISOString();
    items.push({
      externalId,
      title: title || "(untitled)",
      body: description ? description.slice(0, 500) : undefined,
      url: link || undefined,
      publishedAt: pubDate,
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
