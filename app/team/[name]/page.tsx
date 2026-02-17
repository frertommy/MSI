import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRatings,
  getMatches,
  getDailyData,
  getTeamsRegistry,
  getMSILive,
  getMSILiveDaily,
  getMultiLayerDaily,
  getSignalAnalysis,
  getCurrentInjuries,
  getCurrentNews,
  clubEloReference,
  NAME_TO_CLUBELO,
  LEAGUE_LABELS,
} from "@/lib/data";
import { computeElo } from "@/src/elo";
import { getPlayerImportance } from "@/src/playerImportance";
import TeamHeader from "@/app/components/TeamHeader";
import StatsCards from "@/app/components/StatsCards";
import RatingChart from "@/app/components/RatingChart";
import RecentForm from "@/app/components/RecentForm";
import ComparisonCard from "@/app/components/ComparisonCard";
import MarketView from "@/app/components/MarketView";
import SignalAnalysis from "@/app/components/SignalAnalysis";
import InjuryCard from "@/app/components/InjuryCard";
import NewsCard from "@/app/components/NewsCard";

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
  const liveData = getMSILive();
  const liveDailyData = getMSILiveDaily();
  const multiLayerDaily = getMultiLayerDaily();
  const signalAnalysis = getSignalAnalysis();
  const currentInjuries = getCurrentInjuries();
  const currentNews = getCurrentNews();

  const teamIdx = ratings.teams.findIndex((t) => t.team === teamName);
  if (teamIdx === -1) notFound();

  const team = ratings.teams[teamIdx];
  const reg = registry[teamName];
  const leagueLabel = reg ? LEAGUE_LABELS[reg.league] || reg.league : "Unknown";
  const country = reg?.country || "???";

  // Live data for this team
  const liveRating = liveData?.ratings.find((r) => r.team === teamName);
  const liveRank = liveRating?.msiLiveRank ?? teamIdx + 1;
  const msiLive = liveRating?.msiLive ?? null;
  const oddsAdj = liveRating?.oddsAdjustment ?? null;
  const stale = liveData?.stale ?? false;

  // Build chart data — merge base daily with MSI Live daily
  const baseDaily = dailyData[teamName] || [];
  let chartData = baseDaily;

  if (liveDailyData) {
    // Append MSI Live daily snapshots after the last base daily entry
    const lastBaseDate = baseDaily.length > 0 ? baseDaily[baseDaily.length - 1].date : "";
    const liveDays = Object.entries(liveDailyData)
      .filter(([date]) => date > lastBaseDate)
      .sort(([a], [b]) => a.localeCompare(b));

    if (liveDays.length > 0) {
      const livePoints = liveDays
        .map(([date, teams]) => {
          const t = teams[teamName];
          return t ? { date, rating: t.msiLive } : null;
        })
        .filter((p): p is { date: string; rating: number } => p !== null);

      chartData = [...baseDaily, ...livePoints];
    }
  }

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

  // Market view fixtures from MSI Live data
  const marketFixtures: {
    opponent: string;
    date: string;
    marketWinProb: number;
    predictedWinProb: number;
    isHome: boolean;
  }[] = [];

  if (liveData) {
    // Collect all fixtures for this team from all live ratings
    // The live data stores nextFixture per team — but a team may appear in multiple fixtures
    // So also check opponent teams' nextFixture to find additional matches
    if (liveRating?.nextFixture) {
      marketFixtures.push(liveRating.nextFixture);
    }

    // Also check if other teams have this team as their nextFixture opponent
    for (const r of liveData.ratings) {
      if (
        r.nextFixture &&
        r.nextFixture.opponent === teamName &&
        r.team !== teamName
      ) {
        // This team is the opponent — add the inverse fixture
        const alreadyAdded = marketFixtures.some(
          (f) => f.opponent === r.team && f.date === r.nextFixture!.date
        );
        if (!alreadyAdded) {
          marketFixtures.push({
            opponent: r.team,
            date: r.nextFixture.date,
            marketWinProb: 1 - r.nextFixture.marketWinProb,
            predictedWinProb: 1 - r.nextFixture.predictedWinProb,
            isHome: !r.nextFixture.isHome,
          });
        }
      }
    }
  }

  // Match dates for this team (for chart markers)
  const teamMatchDateSet = new Set(
    teamMatches.map((m) => m.date.substring(0, 10))
  );

  // Signal analysis data for this team
  const teamSignalMetrics = signalAnalysis?.perTeam[teamName] ?? null;
  const signalAggregate = signalAnalysis?.aggregate ?? null;

  // Injury data for this team
  const teamInjuryData = currentInjuries?.teams[teamName];
  const injuryPlayers = teamInjuryData
    ? teamInjuryData.injuries.map((inj) => ({
        name: inj.playerName,
        position: inj.position,
        reason: inj.reason,
        importance: getPlayerImportance(inj.playerName, inj.position),
      }))
    : [];
  const injuryRatingEffect = liveRating?.injuryAdjustment ?? 0;

  // News data for this team
  const teamNewsData = currentNews?.teams[teamName];
  const newsEvents = teamNewsData?.events ?? [];
  const newsRatingEffect = liveRating?.newsAdjustment ?? 0;

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
        msiLive={msiLive}
        oddsAdj={oddsAdj}
        rank={liveRank}
        wins={team.wins}
        draws={team.draws}
        losses={team.losses}
        stale={stale}
      />

      {/* Rating Breakdown Card */}
      {oddsAdj !== null && oddsAdj !== 0 && (
        <div className="border border-[var(--color-border)] rounded-md px-4 py-3 bg-[var(--color-bg-card)] mb-8">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
            Rating Breakdown
          </div>
          <div className="flex flex-wrap gap-6 text-xs">
            <div>
              <span className="text-[var(--color-text-dim)]">Base Elo:</span>{" "}
              <span className="font-bold tabular-nums">{Math.round(team.rating)}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-dim)]">Odds Adj:</span>{" "}
              <span
                className={`font-bold tabular-nums ${
                  oddsAdj > 0 ? "text-[var(--color-green)]" : "text-[var(--color-red)]"
                }`}
              >
                {oddsAdj > 0 ? "+" : ""}
                {oddsAdj.toFixed(1)}
              </span>
            </div>
            {injuryRatingEffect !== 0 && (
              <div>
                <span className="text-[var(--color-text-dim)]">Injury Adj:</span>{" "}
                <span className="font-bold tabular-nums text-[#f97316]">
                  {Math.round(injuryRatingEffect)}
                </span>
              </div>
            )}
            {newsRatingEffect !== 0 && (
              <div>
                <span className="text-[var(--color-text-dim)]">News Adj:</span>{" "}
                <span
                  className={`font-bold tabular-nums ${
                    newsRatingEffect > 0 ? "text-[var(--color-green)]" : "text-[#ef4444]"
                  }`}
                >
                  {newsRatingEffect > 0 ? "+" : ""}
                  {newsRatingEffect.toFixed(1)}
                </span>
              </div>
            )}
            <div>
              <span className="text-[var(--color-text-dim)]">MSI Live:</span>{" "}
              <span className="font-bold text-[var(--color-green)] tabular-nums">
                {Math.round(msiLive!)}
              </span>
            </div>
          </div>
          {liveRating?.nextFixture && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-dim)]">
              Next: vs {liveRating.nextFixture.opponent}{" "}
              ({liveRating.nextFixture.isHome ? "H" : "A"}) — Market:{" "}
              <span className="text-[var(--color-text)] font-medium">
                {(liveRating.nextFixture.marketWinProb * 100).toFixed(0)}% win
              </span>
            </div>
          )}
        </div>
      )}

      {injuryPlayers.length > 0 && (
        <InjuryCard
          injuries={injuryPlayers}
          ratingEffect={injuryRatingEffect}
        />
      )}

      {newsEvents.length > 0 && (
        <NewsCard
          events={newsEvents}
          ratingEffect={newsRatingEffect}
        />
      )}

      <RatingChart
        data={chartData}
        multiLayerData={multiLayerDaily?.[teamName] ?? undefined}
        matchDates={teamMatchDateSet}
      />

      {teamSignalMetrics && signalAggregate && (
        <SignalAnalysis
          teamMetrics={teamSignalMetrics}
          aggregate={signalAggregate}
        />
      )}

      <StatsCards
        peakRating={peakRating}
        peakDate={peakDate}
        lowestRating={lowestRating}
        lowestDate={lowestDate}
        currentRank={liveRank}
        totalMatches={team.matches}
        winRate={winRate}
      />

      <RecentForm matches={recentForm} />

      {/* Market View */}
      <MarketView fixtures={marketFixtures} stale={stale} />

      {ceRef && (
        <ComparisonCard
          msiRating={msiLive ?? team.rating}
          msiRank={liveRank}
          clubEloRating={ceRef.elo}
          clubEloRank={ceRef.rank}
        />
      )}

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        MSI v2.0 &middot; Elo Engine: K={ratings.config.kFactor}, Home
        Advantage={ratings.config.homeAdvantage}, Goal Margin Multiplier=ln(|GD|+1)
      </footer>
    </main>
  );
}
