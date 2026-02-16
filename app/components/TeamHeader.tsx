interface TeamHeaderProps {
  team: string;
  league: string;
  country: string;
  rating: number;
  msiLive: number | null;
  oddsAdj: number | null;
  rank: number;
  wins: number;
  draws: number;
  losses: number;
  stale?: boolean;
}

export default function TeamHeader({
  team,
  league,
  country,
  rating,
  msiLive,
  oddsAdj,
  rank,
  wins,
  draws,
  losses,
  stale,
}: TeamHeaderProps) {
  const displayRating = msiLive ?? rating;
  const hasOdds = oddsAdj !== null && oddsAdj !== 0;

  return (
    <div className="mb-8">
      <h1 className="text-xl font-bold tracking-tight mb-1">{team}</h1>
      <p className="text-xs text-[var(--color-text-dim)] mb-4">
        {league} &middot; {country}
      </p>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            MSI Live
          </div>
          <div className="text-4xl font-bold text-[var(--color-green)] tabular-nums">
            {Math.round(displayRating)}
          </div>
          {hasOdds && (
            <div
              className={`text-xs mt-1 tabular-nums ${
                stale ? "text-[var(--color-text-dim)] opacity-60" : ""
              }`}
            >
              <span className="text-[var(--color-text-dim)]">Base: {Math.round(rating)}</span>
              <span className="mx-1 text-[var(--color-text-dim)]">|</span>
              <span
                className={
                  oddsAdj! > 0
                    ? "text-[var(--color-green)]"
                    : "text-[var(--color-red)]"
                }
              >
                Odds: {oddsAdj! > 0 ? "+" : ""}
                {oddsAdj!.toFixed(1)}
              </span>
              {stale && (
                <span className="ml-1 text-[var(--color-yellow)] text-[10px]">
                  (stale)
                </span>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            Overall Rank
          </div>
          <div className="text-2xl font-bold tabular-nums">#{rank}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            Record
          </div>
          <div className="text-lg tabular-nums">
            <span className="text-[var(--color-green)]">{wins}W</span>
            <span className="text-[var(--color-text-dim)]">-{draws}D-</span>
            <span className="text-[var(--color-red)]">{losses}L</span>
          </div>
        </div>
      </div>
    </div>
  );
}
