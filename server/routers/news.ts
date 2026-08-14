import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

export async function fetchLatestNews() {
  const feeds = [
    { name: "SRF", url: "https://www.srf.ch/news/bnf/rss/1646" },
    { name: "Blick", url: "https://www.blick.ch/news/rss.xml" },
    { name: "20 Minuten", url: "https://www.20min.ch/rss/rss.xml" }
  ];

  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error("Fetch failed");
      const xml = await res.text();

      const items: any[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const descMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
        
        const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : "Ohne Titel";
        const desc = descMatch ? (descMatch[1] || descMatch[2]) : "";

        items.push({
          title: title.trim(),
          description: desc.replace(/<[^>]*>?/gm, '').trim().substring(0, 150) + "...",
          source: f.name
        });
      }
      return items;
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r: any) => r.value)
    .flat();
}

export const newsRouter = router({
  getLatest: protectedProcedure.query(async () => {
    return await fetchLatestNews();
  }),
});
