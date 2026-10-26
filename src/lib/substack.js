import { fetchFeedText } from "./feed-cache.js";

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

function tagAttribute(item, tag, attribute) {
  const pattern = "<(?:[\\w.-]+:)?" + tag + "\\b[^>]*\\b" + attribute + "=[\"']([^\"']+)[\"'][^>]*>";
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

function isPodcastPost(item) {
  const hasAudioEnclosure = /<(?:[\w.-]+:)?enclosure\b[^>]*\btype=["']audio\//i.test(item);
  const hasAudioFileEnclosure = /<(?:[\w.-]+:)?enclosure\b[^>]*\burl=["'][^"']+\.(?:mp3|m4a|aac|wav|ogg)(?:\?[^"']*)?["']/i.test(item);
  const hasPodcastDuration = /<(?:itunes:)?duration\b/i.test(item);
  return hasAudioEnclosure || hasAudioFileEnclosure || hasPodcastDuration;
}

function parseEntry(item) {
  const title = tagValue(item, "title");
  const link = tagValue(item, "link") || tagAttribute(item, "link", "href");
  const description = tagValue(item, "description") || tagValue(item, "encoded") || tagValue(item, "summary") || tagValue(item, "content");
  return {
    title,
    link,
    pubDate: tagValue(item, "pubDate") || tagValue(item, "published") || tagValue(item, "updated"),
    description: cleanDescription(description),
    isPodcast: isPodcastPost(item),
  };
}

export async function getNewsletterPosts() {
  const xml = await fetchFeedText(FEED_URL, "substack");
  // Support RSS (<item>) and Atom (<entry>) feeds, including Atom links stored
  // as href attributes. Substack normally serves RSS, but this avoids an empty
  // archive if its feed format changes.
  const rssItems = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => parseEntry(match[1]));
  const atomItems = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => parseEntry(match[1]));
  const items = rssItems.length ? rssItems : atomItems;
  const validPosts = items.filter((post) => post.title && post.link);
  const writtenPosts = validPosts.filter((post) => !post.isPodcast);

  // Some feed variants attach audio metadata to every post. Prefer written-only
  // entries, but never show a completely empty archive if the feed has valid posts.
  const posts = writtenPosts.length ? writtenPosts : validPosts;
  return posts.map(({ isPodcast, ...post }) => post);
}
