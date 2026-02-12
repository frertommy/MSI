interface TeamHeaderProps {
  team: string;
  league: string;
  country: string;
  rating: number;
  rank: number;
  wins: number;
  draws: number;
  losses: number;
}

export default function TeamHeader({
  team,
  league,
  country,
  rating,
  rank,
  wins,
  draws,
  losses,
}: TeamHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-xl font-bold tracking-tight mb-1">{team}</h1>
      <p className="text-xs text-[var(--color-text-dim)] mb-4">
        {league} &middot; {country}
      </p>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            MSI Rating
          </div>
          <div className="text-4xl font-bold text-[var(--color-green)] tabular-nums">
            {Math.round(rating)}
          </div>
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
