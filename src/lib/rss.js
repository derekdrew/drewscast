const RSS_URL = "https://anchor.fm/s/fb3d6a98/podcast/rss";

export async function getEpisodes() {
  const response = await fetch(RSS_URL);

  if (!response.ok) {
    throw new Error(`RSS feed returned ${response.status}`);
  }

  const xml = await response.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  return items.map((match) => {
    const item = match[1];

    const getValue = (tag) => {
      const match = item.match(
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
      );

      return match ? match[1].trim() : "";
    };

    return {
      title: getValue("title"),
      description: getValue("description"),
      pubDate: getValue("pubDate"),
      link: getValue("link"),
    };
  });
}
