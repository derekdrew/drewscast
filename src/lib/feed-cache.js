const SITE_URL = "https://drewscast.com";

function hasFeedEntries(text = "") {
  return /<(?:item|entry)\b/i.test(text);
}

// Cache API copies are location-specific and best-effort. Use KV as the
// durable, shared fallback for the newsletter feed, with Cache API as an
// optional fast path. The podcast feed can continue using Cache API.
export async function fetchFeedText(url, cacheName, freshSeconds = 3600, env) {
  const kv = cacheName === "substack" ? env?.DREWSLETTER_CACHE : undefined;
  const freshKey = `${cacheName}:fresh`;
  const staleKey = `${cacheName}:stale`;
  const cache = globalThis.caches?.default;
  const freshRequest = new Request(`${SITE_URL}/__feed-cache/${cacheName}-fresh`);
  const staleRequest = new Request(`${SITE_URL}/__feed-cache/${cacheName}-stale`);

  // Durable shared cache first. Never trust an empty or malformed value.
  if (kv) {
    try {
      const cached = await kv.get(freshKey);
      if (cached && hasFeedEntries(cached)) return cached;
    } catch {
      // KV failure should not prevent trying the upstream feed.
    }
  }

  // Retain the existing edge cache as an optional fast path.
  if (cache) {
    try {
      const cached = await cache.match(freshRequest);
      if (cached) {
        const text = await cached.text();
        if (hasFeedEntries(text)) return text;
      }
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
    if (!hasFeedEntries(text)) throw new Error("Feed response contained no entries");

    // Persist to KV with separate fresh and stale lifetimes. Writes are
    // best-effort; the page can still render the freshly fetched feed.
    if (kv) {
      await Promise.allSettled([
        kv.put(freshKey, text, { expirationTtl: freshSeconds }),
        kv.put(staleKey, text, { expirationTtl: 604800 }),
      ]);
    }

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
    // Prefer durable stale content, which remains available across Worker
    // instances and data centers, before trying the best-effort edge cache.
    if (kv) {
      try {
        const stale = await kv.get(staleKey);
        if (stale && hasFeedEntries(stale)) return stale;
      } catch {
        // Continue to the Cache API fallback.
      }
    }

    if (cache) {
      try {
        const stale = await cache.match(staleRequest);
        if (stale) {
          const text = await stale.text();
          if (hasFeedEntries(text)) return text;
        }
      } catch {
        // Fall through to the original upstream error.
      }
    }
    throw error;
  }
}
