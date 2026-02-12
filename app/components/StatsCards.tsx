interface StatsCardsProps {
  peakRating: number;
  peakDate: string;
  lowestRating: number;
  lowestDate: string;
  currentRank: number;
  totalMatches: number;
  winRate: number;
}

export default function StatsCards({
  peakRating,
  peakDate,
  lowestRating,
  lowestDate,
  currentRank,
  totalMatches,
  winRate,
}: StatsCardsProps) {
  const cards = [
    {
      label: "Peak Rating",
      value: Math.round(peakRating).toString(),
      sub: peakDate,
      color: "text-[var(--color-green)]",
    },
    {
      label: "Lowest Rating",
      value: Math.round(lowestRating).toString(),
      sub: lowestDate,
      color: "text-[var(--color-red)]",
    },
    {
      label: "Current Rank",
      value: `#${currentRank}`,
      sub: `of 110 teams`,
      color: "text-[var(--color-text)]",
    },
    {
      label: "Total Matches",
      value: totalMatches.toString(),
      sub: `${winRate.toFixed(1)}% win rate`,
      color: "text-[var(--color-text)]",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {cards.map((c) => (
        <div
          key={c.label}
          className="border border-[var(--color-border)] rounded-md px-4 py-3 bg-[var(--color-bg-card)]"
        >
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            {c.label}
          </div>
          <div className={`text-lg font-bold tabular-nums ${c.color}`}>
            {c.value}
          </div>
          <div className="text-[10px] text-[var(--color-text-dim)]">
            {c.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
