/**
 * Ingest news into L1 raw.
 *
 * Reads the current v0 news/current.json and writes an immutable snapshot
 * into data_v1/l1_facts/raw/news/.
 */
import fs from "fs";
import path from "path";
import {
  writeImmutable,
  timestampTag,
  contentHash,
  L1_RAW_NEWS,
  V0_DATA_DIR,
} from "../storage";

export function ingestNews(): { file: string; count: number } {
  const newsFile = path.join(V0_DATA_DIR, "news", "current.json");
  if (!fs.existsSync(newsFile)) {
    console.log("  No news data found — skipping.");
    return { file: "", count: 0 };
  }
  const news = JSON.parse(fs.readFileSync(newsFile, "utf-8"));
  const hash = contentHash(news);
  const tag = timestampTag();
  const fileName = `${tag}_news_${hash}.json`;
  const filePath = path.join(L1_RAW_NEWS, fileName);

  const teamCount = Object.keys(news.teams ?? {}).length;
  const payload = {
    source: "v0_news_current",
    fetchedAt: news.computedAt || new Date().toISOString(),
    payloadHash: hash,
    teamCount,
    data: news,
  };

  writeImmutable(filePath, payload);
  console.log(`  L1 raw news: ${filePath} (${teamCount} teams)`);
  return { file: filePath, count: teamCount };
}

if (require.main === module) {
  console.log("Ingesting news into L1 raw...");
  ingestNews();
  console.log("Done.");
}
