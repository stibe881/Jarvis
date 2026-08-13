import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

export const newsRouter = router({
  getLatest: protectedProcedure.query(async () => {
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
          const itemXml = match[1];
          const titleMatch = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/.exec(itemXml);
          const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
          const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml);
          
          items.push({
            title: titleMatch ? (titleMatch[1] || titleMatch[2]) : "Kein Titel",
            link: linkMatch ? linkMatch[1] : "",
            pubDate: pubDateMatch ? pubDateMatch[1] : "",
          });
        }

        return {
          source: f.name,
          items
        };
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map(r => r.value);
  }),
});
