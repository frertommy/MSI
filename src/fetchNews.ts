/**
 * Fetch News — pulls football news from NewsAPI v2, classifies events,
 * maintains a rolling history with decay, and outputs per-team adjustments.
 *
 * Usage: npm run fetch:news
 * Requires NEWS_API_KEY in .env (or env var)
 */

import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import {
  classifyArticle,
  eventDedupId,
  computeTeamAdjustments,
  NewsHistoryEntry,
  ClassifiedEvent,
} from "./newsClassifier";

const API_KEY = process.env.NEWS_API_KEY;
if (!API_KEY) {
  console.error("NEWS_API_KEY must be set");
  process.exit(1);
}
const BASE_URL = "https://newsapi.org/v2";

// ── League search queries ──
const LEAGUE_QUERIES = [
  "Premier League football",
  "La Liga football",
  "Bundesliga football",
  "Serie A football",
  "Ligue 1 football",
];

// ── Top 20 teams to search individually ──
// These use short recognizable names for better news matches
const TOP_TEAM_QUERIES = [
  "Arsenal FC",
  "Manchester City",
  "Liverpool FC",
  "Chelsea FC",
  "Manchester United",
  "Real Madrid",
  "Barcelona",
  "Bayern Munich",
  "Paris Saint-Germain",
  "Inter Milan",
  "AC Milan",
  "Juventus",
  "Napoli",
  "Borussia Dortmund",
  "Atletico Madrid",
  "Bayer Leverkusen",
  "Tottenham",
  "Aston Villa",
  "Newcastle United",
  "Marseille",
];

interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

// ── Name mapping: news names → internal MSI names ──
function loadNameMapping(dataDir: string): Record<string, string> {
  // Combine odds mapping (already has common names → internal)
  const oddsMappingFile = path.join(dataDir, "name_mapping_odds.json");
  const odds: Record<string, string> = fs.existsSync(oddsMappingFile)
    ? JSON.parse(fs.readFileSync(oddsMappingFile, "utf-8"))
    : {};

  // Also load injury mappings
  const injMappingFile = path.join(dataDir, "name_mapping_injuries.json");
  const inj: Record<string, string> = fs.existsSync(injMappingFile)
    ? JSON.parse(fs.readFileSync(injMappingFile, "utf-8"))
    : {};

  return { ...odds, ...inj };
}

function loadTeamRegistry(
  dataDir: string
): Record<string, { league: string; country: string; matchesPlayed: number }> {
  const file = path.join(dataDir, "teams_registry.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : {};
}

function loadRatings(
  dataDir: string
): { team: string; rating: number }[] {
  const file = path.join(dataDir, "msi_ratings.json");
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  return data.teams.map((t: { team: string; rating: number }) => ({
    team: t.team,
    rating: t.rating,
  }));
}

async function fetchNewsAPI(
  query: string,
  pageSize: number = 20
): Promise<NewsAPIArticle[]> {
  // Search everything endpoint — last 7 days
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const from = fromDate.toISOString().substring(0, 10);

  const params = new URLSearchParams({
    q: query,
    from,
    language: "en",
    sortBy: "relevancy",
    pageSize: String(pageSize),
    apiKey: API_KEY,
  });

  const url = `${BASE_URL}/everything?${params}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NewsAPI error: ${res.status} ${res.statusText} — ${body}`);
  }

  const data: NewsAPIResponse = await res.json();
  return data.articles || [];
}

async function main() {
  if (!API_KEY) {
    console.error("NEWS_API_KEY not set in environment.");
    console.error("Set it in .env or as an environment variable.");
    process.exit(1);
  }

  const dataDir = path.join(__dirname, "..", "data");
  const newsDir = path.join(dataDir, "news");
  fs.mkdirSync(newsDir, { recursive: true });

  // Load team data
  const nameMapping = loadNameMapping(dataDir);
  const registry = loadTeamRegistry(dataDir);
  const ratings = loadRatings(dataDir);
  const allTeamNames = new Set(Object.keys(registry));

  // Resolve a name mentioned in news to our internal name
  function resolveTeamName(name: string): string | null {
    if (allTeamNames.has(name)) return name;
    const mapped = nameMapping[name];
    if (mapped && allTeamNames.has(mapped)) return mapped;
    return null;
  }

  // Build a lookup of short names → internal names for matching
  const shortNameMap: Record<string, string> = {};
  for (const [short, internal] of Object.entries(nameMapping)) {
    shortNameMap[short.toLowerCase()] = internal;
  }
  // Also add registry names directly
  for (const name of allTeamNames) {
    shortNameMap[name.toLowerCase()] = name;
  }

  // Load existing history
  const historyFile = path.join(newsDir, "history.json");
  let history: NewsHistoryEntry[] = [];
  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, "utf-8"));
    } catch {
      console.warn("Could not parse history.json, starting fresh");
      history = [];
    }
  }

  // Build dedup set from existing history
  const existingIds = new Set(history.map((h) => h.id));

  console.log("Fetching news from NewsAPI v2...\n");
  console.log(`Existing history: ${history.length} events`);

  const allArticles: NewsAPIArticle[] = [];
  let requestCount = 0;

  // 1. League-wide queries
  for (const query of LEAGUE_QUERIES) {
    try {
      console.log(`  League: "${query}"...`);
      const articles = await fetchNewsAPI(query, 20);
      allArticles.push(...articles);
      requestCount++;
      console.log(`    → ${articles.length} articles`);
      await new Promise((r) => setTimeout(r, 1200)); // Rate limit
    } catch (err) {
      console.error(`  ERROR fetching "${query}": ${err}`);
    }
  }

  // 2. Top team queries (only if budget allows)
  const maxRequests = 25; // Conservative: 25 of 100 daily budget
  for (const teamQuery of TOP_TEAM_QUERIES) {
    if (requestCount >= maxRequests) {
      console.log(`  Budget limit reached (${requestCount}/${maxRequests}). Stopping team queries.`);
      break;
    }

    try {
      console.log(`  Team: "${teamQuery}"...`);
      const articles = await fetchNewsAPI(`"${teamQuery}" football`, 10);
      allArticles.push(...articles);
      requestCount++;
      console.log(`    → ${articles.length} articles`);
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      console.error(`  ERROR fetching "${teamQuery}": ${err}`);
    }
  }

  console.log(`\nTotal articles fetched: ${allArticles.length}`);
  console.log(`API requests used: ${requestCount}`);

  // Deduplicate articles by URL
  const seenUrls = new Set<string>();
  const uniqueArticles = allArticles.filter((a) => {
    if (seenUrls.has(a.url)) return false;
    seenUrls.add(a.url);
    return true;
  });
  console.log(`Unique articles after dedup: ${uniqueArticles.length}`);

  // Classify articles against all known teams
  const newEvents: ClassifiedEvent[] = [];

  for (const article of uniqueArticles) {
    // Try to classify against each team — but be smart about it.
    // First, extract potential team mentions from the text
    const text = `${article.title} ${article.description || ""}`.toLowerCase();

    for (const [shortName, internalName] of Object.entries(shortNameMap)) {
      // Only check if the short name appears in the text
      if (shortName.length < 4) continue; // Skip very short names
      if (!text.includes(shortName)) continue;

      const event = classifyArticle(
        article.title,
        article.description,
        article.url,
        article.source.id || "",
        article.source.name || "",
        article.publishedAt,
        internalName
      );

      if (event) {
        newEvents.push(event);
        break; // One event per article
      }
    }
  }

  console.log(`\nClassified events: ${newEvents.length}`);

  // Deduplicate against existing history
  let addedCount = 0;
  const now = new Date();

  for (const event of newEvents) {
    const id = eventDedupId(event);
    if (existingIds.has(id)) continue;

    history.push({
      id,
      type: event.type,
      label: event.label,
      eloImpact: event.eloImpact,
      decayDays: event.decayDays,
      headline: event.headline,
      url: event.url,
      source: event.source,
      publishedAt: event.publishedAt,
      team: event.team,
      confidence: Math.round(event.confidence * 100) / 100,
      firstSeen: now.toISOString(),
    });
    existingIds.add(id);
    addedCount++;
  }

  console.log(`New events added to history: ${addedCount}`);

  // Prune fully-decayed events (older than max decay period + buffer)
  const maxDecayDays = 60; // Keep for up to 60 days even if decayed
  const cutoff = new Date(now.getTime() - maxDecayDays * 24 * 60 * 60 * 1000);
  const prunedHistory = history.filter(
    (h) => new Date(h.publishedAt) > cutoff
  );
  const pruned = history.length - prunedHistory.length;
  if (pruned > 0) {
    console.log(`Pruned ${pruned} fully-decayed events`);
  }

  // Save updated history
  fs.writeFileSync(historyFile, JSON.stringify(prunedHistory, null, 2));
  console.log(`Saved ${historyFile} (${prunedHistory.length} events)`);

  // Compute current team adjustments
  const currentNews = computeTeamAdjustments(prunedHistory, now);

  const currentFile = path.join(newsDir, "current.json");
  fs.writeFileSync(currentFile, JSON.stringify(currentNews, null, 2));

  const teamsWithNews = Object.keys(currentNews.teams).length;
  const teamsWithAdjustment = Object.values(currentNews.teams).filter(
    (t) => t.newsAdjustment !== 0
  ).length;

  console.log(`Saved ${currentFile}`);
  console.log(`\n━━━ News Fetch Summary ━━━`);
  console.log(`  Articles fetched: ${allArticles.length} (${uniqueArticles.length} unique)`);
  console.log(`  Events classified: ${newEvents.length}`);
  console.log(`  New events added: ${addedCount}`);
  console.log(`  History size: ${prunedHistory.length}`);
  console.log(`  Teams with events: ${teamsWithNews}`);
  console.log(`  Teams with adjustments: ${teamsWithAdjustment}`);
  console.log(`  API requests used: ${requestCount}`);

  // Print top adjustments
  const sorted = Object.entries(currentNews.teams)
    .sort(([, a], [, b]) => Math.abs(b.newsAdjustment) - Math.abs(a.newsAdjustment))
    .slice(0, 10);

  if (sorted.length > 0) {
    console.log("\n━━━ Top News Adjustments ━━━");
    for (const [team, data] of sorted) {
      const sign = data.newsAdjustment >= 0 ? "+" : "";
      console.log(
        `  ${team.padEnd(35)} ${sign}${data.newsAdjustment.toFixed(1)} pts  (${data.events.length} events)`
      );
    }
  }
}

main();
