import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRatings,
  getMatches,
  getDailyData,
  getTeamsRegistry,
  clubEloReference,
  NAME_TO_CLUBELO,
  LEAGUE_LABELS,
} from "@/lib/data";
import { computeElo } from "@/src/elo";
import TeamHeader from "@/app/components/TeamHeader";
import StatsCards from "@/app/components/StatsCards";
import RatingChart from "@/app/components/RatingChart";
import RecentForm from "@/app/components/RecentForm";
import ComparisonCard from "@/app/components/ComparisonCard";

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  const ratings = getRatings();
  return ratings.teams.map((t) => ({
    name: t.team,
  }));
}

export default async function TeamPage({ params }: PageProps) {
  const { name } = await params;
  const teamName = decodeURIComponent(name);

  const ratings = getRatings();
  const registry = getTeamsRegistry();
  const dailyData = getDailyData();
  const allMatches = getMatches();

  const teamIdx = ratings.teams.findIndex((t) => t.team === teamName);
  if (teamIdx === -1) notFound();

  const team = ratings.teams[teamIdx];
  const rank = teamIdx + 1;
  const reg = registry[teamName];
  const leagueLabel = reg ? LEAGUE_LABELS[reg.league] || reg.league : "Unknown";
  const country = reg?.country || "???";

  // Daily history for chart
  const daily = dailyData[teamName] || [];

  // Stats
  const historyRatings = team.ratingHistory.map((h) => h.rating);
  const peakIdx = historyRatings.indexOf(Math.max(...historyRatings));
  const lowIdx = historyRatings.indexOf(Math.min(...historyRatings));
  const peakRating = historyRatings[peakIdx] ?? team.rating;
  const peakDate = team.ratingHistory[peakIdx]?.date ?? "";
  const lowestRating = historyRatings[lowIdx] ?? team.rating;
  const lowestDate = team.ratingHistory[lowIdx]?.date ?? "";
  const winRate = team.matches > 0 ? (team.wins / team.matches) * 100 : 0;

  // Recent matches for this team (last 10)
  const teamMatches = allMatches.filter(
    (m) => m.homeTeam === teamName || m.awayTeam === teamName
  );
  const last10 = teamMatches.slice(-10);

  // Compute rating changes for recent matches by replaying Elo
  const ratingBefore: Record<string, number> = {};
  for (const t of ratings.teams) {
    ratingBefore[t.team] = ratings.config.initialRating;
  }

  const ratingChanges: Record<number, { home: number; away: number }> = {};
  for (const match of allMatches) {
    const homeR = ratingBefore[match.homeTeam] ?? 1500;
    const awayR = ratingBefore[match.awayTeam] ?? 1500;
    const result = computeElo(
      homeR,
      awayR,
      match.homeGoals,
      match.awayGoals,
      ratings.config
    );
    ratingChanges[match.id] = {
      home: result.homeNewRating - homeR,
      away: result.awayNewRating - awayR,
    };
    ratingBefore[match.homeTeam] = result.homeNewRating;
    ratingBefore[match.awayTeam] = result.awayNewRating;
  }

  const recentForm = last10.map((m) => {
    const isHome = m.homeTeam === teamName;
    const opponent = isHome ? m.awayTeam : m.homeTeam;
    const goals = isHome ? m.homeGoals : m.awayGoals;
    const oppGoals = isHome ? m.awayGoals : m.homeGoals;
    const result = goals > oppGoals ? "W" : goals < oppGoals ? "L" : "D";
    const score = isHome
      ? `${m.homeGoals}-${m.awayGoals}`
      : `${m.awayGoals}-${m.homeGoals}`;
    const change = ratingChanges[m.id];
    const ratingChange = change
      ? isHome
        ? change.home
        : change.away
      : 0;

    return {
      date: m.date.substring(0, 10),
      opponent,
      homeAway: (isHome ? "H" : "A") as "H" | "A",
      score,
      result: result as "W" | "D" | "L",
      ratingChange,
    };
  });

  // ClubElo comparison
  const clubEloName = NAME_TO_CLUBELO[teamName];
  const ceRef = clubEloName
    ? clubEloReference.find((r) => r.team === clubEloName)
    : null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-green)] transition-colors mb-6 inline-block"
      >
        &larr; Back to Rankings
      </Link>

      <TeamHeader
        team={teamName}
        league={leagueLabel}
        country={country}
        rating={team.rating}
        rank={rank}
        wins={team.wins}
        draws={team.draws}
        losses={team.losses}
      />

      <RatingChart data={daily} />

      <StatsCards
        peakRating={peakRating}
        peakDate={peakDate}
        lowestRating={lowestRating}
        lowestDate={lowestDate}
        currentRank={rank}
        totalMatches={team.matches}
        winRate={winRate}
      />

      <RecentForm matches={recentForm} />

      {ceRef && (
        <ComparisonCard
          msiRating={team.rating}
          msiRank={rank}
          clubEloRating={ceRef.elo}
          clubEloRank={ceRef.rank}
        />
      )}

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        MSI v1.0 &middot; Elo Engine: K={ratings.config.kFactor}, Home
        Advantage={ratings.config.homeAdvantage}, Goal Margin Multiplier=ln(|GD|+1)
      </footer>
    </main>
  );
}
