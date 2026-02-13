import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const SEASONS = [
  "1516", "1617", "1718", "1819", "1920",
  "2021", "2122", "2223", "2324", "2425",
];

const SEASON_LABELS: Record<string, string> = {
  "1516": "2015-2016", "1617": "2016-2017", "1718": "2017-2018",
  "1819": "2018-2019", "1920": "2019-2020", "2021": "2020-2021",
  "2122": "2021-2022", "2223": "2022-2023", "2324": "2023-2024",
  "2425": "2024-2025",
};

const LEAGUES = [
  { csv: "E0", msi: "PL" },
  { csv: "SP1", msi: "PD" },
  { csv: "D1", msi: "BL1" },
  { csv: "I1", msi: "SA" },
  { csv: "F1", msi: "FL1" },
];

const BASE_URL = "https://www.football-data.co.uk/mmz4281";
const DELAY_MS = 2000;

interface Match {
  id: number;
  date: string;
  league: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  matchday: number;
}

function sleep(ms: number): void {
  execSync(`sleep ${ms / 1000}`);
}

function parseDate(dateStr: string): string | null {
  // DD/MM/YYYY or DD/MM/YY format
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  let year = parts[2];
  if (year.length === 2) {
    year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
  }
  const d = parseInt(day), m = parseInt(month), y = parseInt(year);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000) return null;
  return `${year}-${month}-${day}T15:00:00Z`;
}

function parseCSV(content: string): Record<string, string>[] {
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      row[headers[j]] = values[j]?.trim() || "";
    }
    rows.push(row);
  }

  return rows;
}

function main() {
  const histDir = path.join(__dirname, "..", "data", "historical");
  const dataDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(histDir, { recursive: true });

  // Load name mapping
  const mappingFile = path.join(dataDir, "name_mapping_historical.json");
  let nameMap: Record<string, string> = {};
  if (fs.existsSync(mappingFile)) {
    nameMap = JSON.parse(fs.readFileSync(mappingFile, "utf-8"));
  }

  function mapName(name: string): string {
    return nameMap[name] || name;
  }

  const allMatches: Match[] = [];
  let idCounter = 1000000; // Start IDs high to avoid collision with API match IDs
  let fetchCount = 0;
  const totalFetches = SEASONS.length * LEAGUES.length;

  for (const season of SEASONS) {
    for (const league of LEAGUES) {
      fetchCount++;
      const filename = `${league.csv}_${season}.csv`;
      const filePath = path.join(histDir, filename);

      // Download if not already cached
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100) {
        const url = `${BASE_URL}/${season}/${league.csv}.csv`;
        console.log(
          `[${fetchCount}/${totalFetches}] Downloading ${league.msi} ${SEASON_LABELS[season]}...`
        );

        try {
          const cmd = `curl -s --max-time 30 "${url}"`;
          const result = execSync(cmd, {
            encoding: "latin1", // football-data.co.uk uses Windows-1252
            maxBuffer: 10 * 1024 * 1024,
          });

          if (result.length < 100 || result.includes("<!DOCTYPE")) {
            console.warn(`  Empty or HTML response, skipping.`);
            continue;
          }

          fs.writeFileSync(filePath, result, "latin1");
          console.log(`  Saved ${filename} (${result.length} bytes)`);
        } catch (err: any) {
          console.warn(
            `  Download failed: ${err.message?.substring(0, 80)}. Skipping.`
          );
          continue;
        }

        if (fetchCount < totalFetches) {
          sleep(DELAY_MS);
        }
      } else {
        console.log(
          `[${fetchCount}/${totalFetches}] Cached: ${league.msi} ${SEASON_LABELS[season]}`
        );
      }

      // Parse the CSV
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "latin1");
      const rows = parseCSV(content);

      let matchCount = 0;
      for (const row of rows) {
        const dateStr = row["Date"];
        const homeTeam = row["HomeTeam"];
        const awayTeam = row["AwayTeam"];
        const fthg = row["FTHG"];
        const ftag = row["FTAG"];

        if (!dateStr || !homeTeam || !awayTeam || fthg === "" || ftag === "") continue;

        const homeGoals = parseInt(fthg);
        const awayGoals = parseInt(ftag);
        if (isNaN(homeGoals) || isNaN(awayGoals)) continue;

        const isoDate = parseDate(dateStr);
        if (!isoDate) continue;

        allMatches.push({
          id: idCounter++,
          date: isoDate,
          league: league.msi,
          season: SEASON_LABELS[season],
          homeTeam: mapName(homeTeam),
          awayTeam: mapName(awayTeam),
          homeGoals,
          awayGoals,
          matchday: 0,
        });
        matchCount++;
      }

      console.log(`  Parsed ${matchCount} matches`);
    }
  }

  // Sort by date ascending
  allMatches.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Save
  const outFile = path.join(dataDir, "matches_historical.json");
  fs.writeFileSync(outFile, JSON.stringify(allMatches, null, 2));
  console.log(`\nSaved ${outFile} (${allMatches.length} matches)`);

  // Summary
  console.log("\n━━━ Historical Fetch Summary ━━━");
  console.log(`Total matches: ${allMatches.length}`);

  const byLeagueSeason: Record<string, Record<string, number>> = {};
  for (const m of allMatches) {
    if (!byLeagueSeason[m.league]) byLeagueSeason[m.league] = {};
    byLeagueSeason[m.league][m.season] =
      (byLeagueSeason[m.league][m.season] || 0) + 1;
  }

  for (const league of LEAGUES) {
    const seasons = byLeagueSeason[league.msi] || {};
    const total = Object.values(seasons).reduce((a, b) => a + b, 0);
    const parts = Object.entries(seasons)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([s, c]) => `${s.substring(0, 4)}: ${c}`);
    console.log(`  ${league.msi} (${total} total): ${parts.join(", ")}`);
  }

  if (allMatches.length > 0) {
    console.log(
      `Date range: ${allMatches[0].date.substring(0, 10)} to ${allMatches[allMatches.length - 1].date.substring(0, 10)}`
    );
  }

  // Count unique teams
  const teams = new Set<string>();
  for (const m of allMatches) {
    teams.add(m.homeTeam);
    teams.add(m.awayTeam);
  }
  console.log(`Unique teams: ${teams.size}`);
}

main();
