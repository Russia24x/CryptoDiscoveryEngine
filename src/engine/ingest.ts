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
  body?: string;
  url?: string;
  publishedAt: Date;
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
 */
export function parseTelegram(html: string): IngestedItem[] {
  const items: IngestedItem[] = [];
  // Split by message wrapper
  const messageBlocks = html.split(/class="tgme_widget_message /).slice(1);
  for (const block of messageBlocks.slice(0, 20)) {
    // Extract message text
    const textMatch = block.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    );
    // Extract datetime
    const timeMatch = block.match(/datetime="([^"]+)"/i);
    // Extract post link
    const linkMatch = block.match(/class="tgme_widget_message_date"[^>]*href="([^"]+)"/i);

    const rawText = textMatch ? stripHtml(textMatch[1]) : "";
    if (!rawText) continue;

    const publishedAt = timeMatch ? new Date(timeMatch[1]) : new Date();
    if (isNaN(publishedAt.getTime())) continue;

    const url = linkMatch ? linkMatch[1] : undefined;
    const externalId = url || `${publishedAt.getTime()}-${rawText.slice(0, 20)}`;

    items.push({
      externalId,
      title: rawText.slice(0, 120) + (rawText.length > 120 ? "…" : ""),
      body: rawText.slice(0, 500),
      url,
      publishedAt,
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
