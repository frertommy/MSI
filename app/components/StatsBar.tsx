interface StatsBarProps {
  teamsRated: number;
  matchesProcessed: number;
  leagues: number;
  topRating: number;
  topTeam: string;
}

export default function StatsBar({
  teamsRated,
  matchesProcessed,
  leagues,
  topRating,
  topTeam,
}: StatsBarProps) {
  const stats = [
    { label: "Teams Rated", value: teamsRated.toString() },
    { label: "Matches Processed", value: matchesProcessed.toLocaleString() },
    { label: "Leagues", value: leagues.toString() },
    { label: "Seasons", value: "2 (2023-2025)" },
    { label: "Top MSI", value: `${Math.round(topRating)} (${topTeam})` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="border border-[var(--color-border)] rounded-md px-4 py-3 bg-[var(--color-bg-card)]"
        >
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            {s.label}
          </div>
          <div className="text-sm font-bold text-[var(--color-green)] tabular-nums">
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
