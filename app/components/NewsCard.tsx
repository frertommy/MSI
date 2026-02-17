interface NewsEvent {
  type: string;
  label: string;
  headline: string;
  url: string;
  source: string;
  publishedAt: string;
  rawImpact: number;
  decayedImpact: number;
  daysAgo: number;
}

interface NewsCardProps {
  events: NewsEvent[];
  ratingEffect: number;
}

function impactDot(impact: number): { color: string; label: string } {
  const abs = Math.abs(impact);
  if (abs >= 10) return { color: "#ef4444", label: "major" };
  if (abs >= 5) return { color: "#eab308", label: "moderate" };
  return { color: "#888898", label: "minor" };
}

export default function NewsCard({ events, ratingEffect }: NewsCardProps) {
  if (events.length === 0) return null;

  return (
    <div className="border border-[#ef4444]/30 rounded-md px-4 py-3 bg-[var(--color-bg-card)] mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[#ef4444]">
          News Events
        </div>
        <div className="text-[10px] text-[var(--color-text-dim)]">
          Impact:{" "}
          <span
            className={`font-medium tabular-nums ${
              ratingEffect >= 0 ? "text-[var(--color-green)]" : "text-[#ef4444]"
            }`}
          >
            {ratingEffect >= 0 ? "+" : ""}
            {Math.round(ratingEffect)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {events.map((ev, i) => {
          const dot = impactDot(ev.decayedImpact);
          return (
            <div key={i} className="flex items-start gap-3 text-xs">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1"
                style={{ backgroundColor: dot.color }}
                title={dot.label}
              />
              <div className="flex-1 min-w-0">
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-[#ef4444] transition-colors line-clamp-1"
                  title={ev.headline}
                >
                  {ev.headline}
                </a>
                <div className="flex gap-3 text-[10px] text-[var(--color-text-dim)] mt-0.5">
                  <span>{ev.source}</span>
                  <span>{ev.daysAgo === 0 ? "today" : `${ev.daysAgo}d ago`}</span>
                  <span className="uppercase text-[9px]">{ev.label}</span>
                </div>
              </div>
              <span
                className={`tabular-nums text-[10px] w-[40px] text-right flex-shrink-0 ${
                  ev.decayedImpact >= 0
                    ? "text-[var(--color-green)]"
                    : "text-[#ef4444]"
                }`}
              >
                [{ev.decayedImpact >= 0 ? "+" : ""}
                {ev.decayedImpact.toFixed(1)}]
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-dim)]">
        Rating Effect:{" "}
        <span
          className={`font-medium tabular-nums ${
            ratingEffect >= 0 ? "text-[var(--color-green)]" : "text-[#ef4444]"
          }`}
        >
          {ratingEffect >= 0 ? "+" : ""}
          {Math.round(ratingEffect)} pts
        </span>
        <span className="text-[var(--color-text-dim)] ml-2 text-[10px]">
          ({events.length} event{events.length !== 1 ? "s" : ""} active)
        </span>
      </div>
    </div>
  );
}
