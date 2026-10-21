export const prerender = false;

import { getEpisodes } from "../lib/rss.js";

const SITE_URL = "https://drewscast.com";

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET() {
  const episodes = await getEpisodes();
  const urls = [
    { loc: SITE_URL + "/", changefreq: "weekly", priority: "1.0" },
    { loc: SITE_URL + "/episodes", changefreq: "daily", priority: "0.9" },
    { loc: SITE_URL + "/drewsletter", changefreq: "daily", priority: "0.8" },
    ...episodes.map((episode) => ({
      loc: SITE_URL + "/episodes/" + encodeURIComponent(episode.slug),
      lastmod: episode.pubDate ? new Date(episode.pubDate).toISOString() : undefined,
      changefreq: "monthly",
      priority: "0.7",
    })),
  ];

  const entries = urls.map((url) => [
    "<url>",
    "<loc>" + escapeXml(url.loc) + "</loc>",
    url.lastmod ? "<lastmod>" + escapeXml(url.lastmod) + "</lastmod>" : "",
    "<changefreq>" + url.changefreq + "</changefreq>",
    "<priority>" + url.priority + "</priority>",
    "</url>",
  ].join("")).join("");

  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries + "</urlset>", {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
