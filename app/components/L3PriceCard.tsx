"use client";

interface Props {
  l3Rating: number;
  baseElo: number;
  marketConsensus: number;
  premium: number;
  oraclePrice: number;
  confidence: number;
  components: {
    matchImplied: number;
    matchCount: number;
    avgWinProb: number;
  };
  dataFreshness: string;
  timestamp: string;
}

export default function L3PriceCard({
  l3Rating,
  baseElo,
  marketConsensus,
  premium,
  oraclePrice,
  confidence,
  components,
  dataFreshness,
  timestamp,
}: Props) {
  const premiumColor =
    premium > 0
      ? "text-[var(--color-green)]"
      : premium < 0
        ? "text-[var(--color-red)]"
        : "text-[var(--color-text-dim)]";

  const confPct = Math.round(confidence * 100);
  const confColor =
    confPct >= 80
      ? "bg-[var(--color-green)]"
      : confPct >= 60
        ? "bg-[var(--color-yellow)]"
        : "bg-[var(--color-red)]";

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4 space-y-4">
      {/* Breakdown */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
          Rating Breakdown
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-dim)]">Base ELO (L1):</span>
            <span className="font-bold tabular-nums">{Math.round(baseElo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-dim)]">Market Consensus:</span>
            <span className="font-bold tabular-nums">{Math.round(marketConsensus)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-dim)]">Market Premium:</span>
            <span className={`font-bold tabular-nums ${premiumColor}`}>
              {premium > 0 ? "+" : ""}{premium.toFixed(1)} pts
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-dim)]">L3 Derived:</span>
            <span className="font-bold tabular-nums text-[var(--color-green)]">
              {Math.round(l3Rating)}
            </span>
          </div>
        </div>
      </div>

      {/* Market Components */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
          Market Components
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="border border-[var(--color-border)]/50 rounded p-2">
            <div className="text-[10px] text-[var(--color-text-dim)]">Implied Rating</div>
            <div className="text-sm font-bold tabular-nums">{Math.round(components.matchImplied)}</div>
          </div>
          <div className="border border-[var(--color-border)]/50 rounded p-2">
            <div className="text-[10px] text-[var(--color-text-dim)]">Matches Used</div>
            <div className="text-sm font-bold tabular-nums">{components.matchCount}</div>
          </div>
          <div className="border border-[var(--color-border)]/50 rounded p-2">
            <div className="text-[10px] text-[var(--color-text-dim)]">Avg Win Prob</div>
            <div className="text-sm font-bold tabular-nums">
              {components.avgWinProb > 0 ? `${(components.avgWinProb * 100).toFixed(1)}%` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[var(--color-text-dim)]">Data Confidence:</span>
          <span className="font-bold">{confPct}%</span>
        </div>
        <div className="w-full bg-[var(--color-border)]/30 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${confColor}`}
            style={{ width: `${confPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[var(--color-text-dim)] mt-1">
          <span>Freshness: {dataFreshness}</span>
          <span>{new Date(timestamp).toLocaleString()}</span>
        </div>
      </div>

      {/* Weights info */}
      <div className="text-[10px] text-[var(--color-text-dim)] border-t border-[var(--color-border)]/50 pt-2">
        L3 = 80% Market Consensus + 20% Base ELO | Oracle = P₀ &times; exp(β &times; (L3 &minus; MSI₀))
      </div>
    </div>
  );
}
