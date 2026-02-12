import fs from "fs";
import path from "path";

export interface TeamRating {
  team: string;
  rating: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  lastUpdated: string;
  ratingHistory: { date: string; rating: number }[];
}

export interface EloConfig {
  initialRating: number;
  kFactor: number;
  homeAdvantage: number;
  goalMarginFactor: boolean;
  leagueStrength: Record<string, number>;
  leagueBaseline: Record<string, number>;
  seasonRegression: number;
}

export interface RatingsFile {
  config: EloConfig;
  computedAt: string;
  matchesProcessed: number;
  teams: TeamRating[];
}

export interface Match {
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

export interface TeamRegistryEntry {
  league: string;
  country: string;
  matchesPlayed: number;
}

export type DailyData = Record<string, { date: string; rating: number }[]>;
export type TeamsRegistry = Record<string, TeamRegistryEntry>;

const dataDir = path.join(process.cwd(), "data");

function readJSON<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename), "utf-8"));
}

export function getRatings(): RatingsFile {
  return readJSON<RatingsFile>("msi_ratings.json");
}

export function getMatches(): Match[] {
  return readJSON<Match[]>("matches_all.json");
}

export function getDailyData(): DailyData {
  return readJSON<DailyData>("msi_daily.json");
}

export function getTeamsRegistry(): TeamsRegistry {
  return readJSON<TeamsRegistry>("teams_registry.json");
}

export const LEAGUE_LABELS: Record<string, string> = {
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  SA: "Serie A",
  FL1: "Ligue 1",
};

export const LEAGUE_COUNTRY: Record<string, string> = {
  PL: "ENG",
  PD: "ESP",
  BL1: "GER",
  SA: "ITA",
  FL1: "FRA",
};

export const COUNTRY_LEAGUE: Record<string, string> = {
  ENG: "PL",
  ESP: "PD",
  GER: "BL1",
  ITA: "SA",
  FRA: "FL1",
};

export const clubEloReference: { team: string; elo: number; rank: number }[] = [
  { team: "Arsenal", elo: 2052, rank: 1 },
  { team: "Bayern Munich", elo: 1996, rank: 2 },
  { team: "Manchester City", elo: 1983, rank: 3 },
  { team: "Paris Saint-Germain", elo: 1969, rank: 4 },
  { team: "Barcelona", elo: 1949, rank: 5 },
  { team: "Liverpool", elo: 1941, rank: 6 },
  { team: "Inter Milan", elo: 1926, rank: 7 },
  { team: "Aston Villa", elo: 1924, rank: 8 },
  { team: "Real Madrid", elo: 1917, rank: 9 },
  { team: "Chelsea", elo: 1883, rank: 10 },
  { team: "Atletico Madrid", elo: 1871, rank: 11 },
  { team: "Napoli", elo: 1864, rank: 12 },
  { team: "Bayer Leverkusen", elo: 1861, rank: 13 },
  { team: "Newcastle", elo: 1842, rank: 14 },
  { team: "AC Milan", elo: 1838, rank: 15 },
  { team: "Juventus", elo: 1830, rank: 16 },
  { team: "Tottenham", elo: 1828, rank: 17 },
  { team: "Borussia Dortmund", elo: 1822, rank: 18 },
  { team: "Brighton", elo: 1808, rank: 19 },
  { team: "Marseille", elo: 1800, rank: 20 },
];

export const NAME_TO_CLUBELO: Record<string, string> = {
  "Arsenal FC": "Arsenal",
  "FC Bayern München": "Bayern Munich",
  "Manchester City FC": "Manchester City",
  "Paris Saint-Germain FC": "Paris Saint-Germain",
  "FC Barcelona": "Barcelona",
  "Liverpool FC": "Liverpool",
  "FC Internazionale Milano": "Inter Milan",
  "Aston Villa FC": "Aston Villa",
  "Real Madrid CF": "Real Madrid",
  "Chelsea FC": "Chelsea",
  "Club Atlético de Madrid": "Atletico Madrid",
  "SSC Napoli": "Napoli",
  "Bayer 04 Leverkusen": "Bayer Leverkusen",
  "Newcastle United FC": "Newcastle",
  "AC Milan": "AC Milan",
  "Juventus FC": "Juventus",
  "Tottenham Hotspur FC": "Tottenham",
  "Borussia Dortmund": "Borussia Dortmund",
  "Brighton & Hove Albion FC": "Brighton",
  "Olympique de Marseille": "Marseille",
};
