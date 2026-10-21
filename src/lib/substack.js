const FEED_URL = "https://thedrewsletter.substack.com/feed";

function decodeEntities(value = "") {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function tagValue(item, tag) {
  const pattern = "<(?:[\\w.-]+:)?" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?" + tag + "\\s*>";
  const match = item.match(new RegExp(pattern, "i"));
  return match ? decodeEntities(match[1].trim()) : "";
}

function cleanDescription(value = "") {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getNewsletterPosts() {
  const response = await fetch(FEED_URL, {
    headers: { accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!response.ok) throw new Error("Drewsletter feed returned " + response.status);
  const xml = await response.text();
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.map(({ 1: item }) => ({
    title: tagValue(item, "title"),
    link: tagValue(item, "link"),
    pubDate: tagValue(item, "pubDate"),
    description: cleanDescription(tagValue(item, "description") || tagValue(item, "encoded")),
  })).filter((post) => post.title && post.link);
}
