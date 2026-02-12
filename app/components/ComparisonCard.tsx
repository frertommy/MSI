interface ComparisonCardProps {
  msiRating: number;
  msiRank: number;
  clubEloRating: number | null;
  clubEloRank: number | null;
}

export default function ComparisonCard({
  msiRating,
  msiRank,
  clubEloRating,
  clubEloRank,
}: ComparisonCardProps) {
  if (!clubEloRating || !clubEloRank) return null;

  const diff = Math.round(msiRating) - clubEloRating;

  return (
    <div className="border border-[var(--color-border)] rounded-md px-4 py-4 bg-[var(--color-bg-card)] mb-8">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
        How MSI compares to other ratings
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-[var(--color-text-dim)] mb-1">MSI Rating</div>
          <div className="text-lg font-bold text-[var(--color-green)] tabular-nums">
            {Math.round(msiRating)}
          </div>
          <div className="text-[10px] text-[var(--color-text-dim)]">
            Rank #{msiRank}
          </div>
        </div>
        <div>
          <div className="text-[var(--color-text-dim)] mb-1">ClubElo</div>
          <div className="text-lg font-bold tabular-nums">{clubEloRating}</div>
          <div className="text-[10px] text-[var(--color-text-dim)]">
            Rank #{clubEloRank}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs">
        <span className="text-[var(--color-text-dim)]">Difference: </span>
        <span
          className={`tabular-nums font-medium ${
            diff >= 0
              ? "text-[var(--color-green)]"
              : "text-[var(--color-red)]"
          }`}
        >
          {diff >= 0 ? "+" : ""}
          {diff} points
        </span>
        <span className="text-[var(--color-text-dim)]">
          {" "}
          (rank {msiRank > clubEloRank ? "+" : ""}
          {msiRank - clubEloRank})
        </span>
      </div>
    </div>
  );
}
