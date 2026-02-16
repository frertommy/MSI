interface InjuredPlayer {
  name: string;
  position: string;
  reason: string;
  importance: number;
}

interface InjuryCardProps {
  injuries: InjuredPlayer[];
  ratingEffect: number;
}

function importanceDot(importance: number): {
  color: string;
  label: string;
} {
  if (importance >= 0.8) return { color: "#ef4444", label: "star" };
  if (importance >= 0.5) return { color: "#eab308", label: "key" };
  return { color: "#888898", label: "squad" };
}

export default function InjuryCard({
  injuries,
  ratingEffect,
}: InjuryCardProps) {
  if (injuries.length === 0) return null;

  // Sort by importance descending
  const sorted = [...injuries].sort((a, b) => b.importance - a.importance);

  return (
    <div className="border border-[#f97316]/30 rounded-md px-4 py-3 bg-[var(--color-bg-card)] mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[#f97316]">
          Injuries
        </div>
        <div className="text-[10px] text-[var(--color-text-dim)]">
          Impact:{" "}
          <span className="text-[#f97316] font-medium tabular-nums">
            {Math.round(ratingEffect)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {sorted.map((inj, i) => {
          const dot = importanceDot(inj.importance);
          return (
            <div
              key={i}
              className="flex items-center gap-3 text-xs"
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: dot.color }}
                title={dot.label}
              />
              <span className="font-medium w-[140px] truncate">
                {inj.name}
              </span>
              <span className="text-[var(--color-text-dim)] w-[80px] text-[10px]">
                {inj.position}
              </span>
              <span className="text-[var(--color-text-dim)] flex-1 truncate text-[10px]">
                {inj.reason}
              </span>
              <span className="tabular-nums text-[#f97316] text-[10px] w-[40px] text-right">
                [{(-inj.importance * 15).toFixed(1)}]
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-dim)]">
        Rating Effect:{" "}
        <span className="text-[#f97316] font-medium tabular-nums">
          {Math.round(ratingEffect)} pts
        </span>
        <span className="text-[var(--color-text-dim)] ml-2 text-[10px]">
          ({injuries.length} player{injuries.length !== 1 ? "s" : ""} out)
        </span>
      </div>
    </div>
  );
}
