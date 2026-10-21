const RSS_URL = "https://anchor.fm/s/fb3d6a98/podcast/rss";

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

function getTag(item, tag) {
  const pattern = "<(?:[\\\\w.-]+:)?" + tag + "[^>]*>([\\\\s\\S]*?)</(?:[\\\\w.-]+:)?" + tag + "\\s*>";
  const match = item.match(new RegExp(pattern, "i"));
  return match ? decodeEntities(match[1].trim()) : "";
}

function getAttribute(item, tag, attribute) {
  const pattern = "<" + tag + "\\b[^>]*\\b" + attribute + "=[\\"']([^\\"']+)[\\"'][^>]*>";
  const match = item.match(new RegExp(pattern, "i"));
  return match ? decodeEntities(match[1].trim()) : "";
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function episodeSlug(episode) {
  const titleSlug = (episode.title || "episode")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 75);
  return titleSlug || encodeURIComponent(episode.guid || "episode");
}

export async function getEpisodes() {
  const response = await fetch(RSS_URL, {
    headers: { accept: "application/rss+xml, application/xml, text/xml" },
  });

  if (!response.ok) {
    throw new Error("RSS feed returned " + response.status);
  }

  const xml = await response.text();
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];

  return items.map((match) => {
    const item = match[1];
    const title = getTag(item, "title");
    const rawDescription = getTag(item, "description") || getTag(item, "encoded");
    const guid = getTag(item, "guid") || getTag(item, "id");
    const link = getTag(item, "link");

    return {
      title,
      description: stripHtml(rawDescription),
      pubDate: getTag(item, "pubDate"),
      link,
      guid,
      audioUrl: getAttribute(item, "enclosure", "url"),
      duration: getTag(item, "duration"),
      slug: episodeSlug({ title, guid }),
    };
  });
}
