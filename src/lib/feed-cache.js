const SITE_URL = "https://drewscast.com";

// Cloudflare's Cache API is best-effort. Keep a short-lived fresh copy and
// a longer-lived fallback copy so a temporary upstream outage doesn't blank
// content or break the sitemap. If the Cache API isn't available, fetch live.
export async function fetchFeedText(url, cacheName, freshSeconds = 3600) {
  const cache = globalThis.caches?.default;
  const freshRequest = new Request(`${SITE_URL}/__feed-cache/${cacheName}-fresh`);
  const staleRequest = new Request(`${SITE_URL}/__feed-cache/${cacheName}-stale`);

  if (cache) {
    try {
      const cached = await cache.match(freshRequest);
      if (cached) return await cached.text();
    } catch {
      // Cache failures should never prevent a live fetch.
    }
  }

  try {
    const response = await fetch(url, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const text = await response.text();
    if (!text.trim()) throw new Error("Feed returned an empty response");

    if (cache) {
      const freshResponse = new Response(text, {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": `public, max-age=${freshSeconds}` },
      });
      const staleResponse = new Response(text, {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=604800" },
      });
      await Promise.allSettled([
        cache.put(freshRequest, freshResponse),
        cache.put(staleRequest, staleResponse),
      ]);
    }
    return text;
  } catch (error) {
    if (cache) {
      try {
        const stale = await cache.match(staleRequest);
        if (stale) return await stale.text();
      } catch {
        // Fall through to the original upstream error.
      }
    }
    throw error;
  }
}
