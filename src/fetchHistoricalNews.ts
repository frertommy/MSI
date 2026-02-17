import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const API_KEY = process.env.NEWS_API_KEY || "";
const BASE_URL = "https://newsapi.org/v2/everything";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchNewsForDate(date: string) {
  console.log(`\nFetching news for ${date}...`);

  const url = `${BASE_URL}?q=football&from=${date}&to=${date}&language=en&sortBy=relevancy&pageSize=100&apiKey=${API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  ERROR: ${res.status} ${res.statusText}`);
    return [];
  }

  const json = await res.json();
  const articles = json.articles || [];
  console.log(`  Found ${articles.length} articles`);

  return articles;
}

async function main() {
  if (!API_KEY) {
    console.error("NEWS_API_KEY not set");
    process.exit(1);
  }

  const dataDir = path.join(__dirname, "..", "data");
  const archiveDir = path.join(dataDir, "news", "archive");
  fs.mkdirSync(archiveDir, { recursive: true });

  // Last 30 days (NewsAPI free tier limit)
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().substring(0, 10));
  }

  console.log(`Backfilling ${dates.length} days of news data...`);

  for (const date of dates) {
    const archiveFile = path.join(archiveDir, `${date}.json`);

    if (fs.existsSync(archiveFile)) {
      console.log(`Skipping ${date} (already exists)`);
      continue;
    }

    try {
      const articles = await fetchNewsForDate(date);
      fs.writeFileSync(archiveFile, JSON.stringify(articles, null, 2));
      console.log(`  Saved ${articles.length} articles for ${date}`);
    } catch (err) {
      console.error(`  ERROR on ${date}:`, err);
    }

    await delay(1500); // Rate limit: NewsAPI allows 1 request/sec on free tier
  }

  console.log("\nBackfill complete!");
}

main();
