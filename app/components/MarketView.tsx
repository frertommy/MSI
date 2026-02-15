interface MarketFixture {
  opponent: string;
  date: string;
  marketWinProb: number;
  predictedWinProb: number;
  isHome: boolean;
}

interface MarketViewProps {
  fixtures: MarketFixture[];
  stale?: boolean;
}

export default function MarketView({ fixtures, stale }: MarketViewProps) {
  if (fixtures.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
        Market View — Upcoming Fixtures
        {stale && (
          <span className="ml-2 text-[var(--color-yellow)]">(odds may be outdated)</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
              <th className="text-left py-2 px-2">Opponent</th>
              <th className="text-center py-2 px-2 w-10">H/A</th>
              <th className="text-left py-2 px-2 w-28">Date</th>
              <th className="text-right py-2 px-2 w-20">Model</th>
              <th className="text-right py-2 px-2 w-20">Market</th>
              <th className="text-right py-2 px-2 w-20">Gap</th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((f, i) => {
              const gap = f.marketWinProb - f.predictedWinProb;
              return (
                <tr
                  key={i}
                  className={`border-b border-[var(--color-border)]/50 ${
                    stale ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-1.5 px-2">{f.opponent}</td>
                  <td className="py-1.5 px-2 text-center text-[var(--color-text-dim)]">
                    {f.isHome ? "H" : "A"}
                  </td>
                  <td className="py-1.5 px-2 text-[var(--color-text-dim)] tabular-nums">
                    {f.date.substring(0, 10)}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-[var(--color-text-dim)]">
                    {(f.predictedWinProb * 100).toFixed(0)}%
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-medium">
                    {(f.marketWinProb * 100).toFixed(0)}%
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right tabular-nums font-medium ${
                      gap > 0
                        ? "text-[var(--color-green)]"
                        : gap < 0
                          ? "text-[var(--color-red)]"
                          : "text-[var(--color-text-dim)]"
                    }`}
                  >
                    {gap > 0 ? "+" : ""}
                    {(gap * 100).toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--color-text-dim)] mt-2">
        Gap: positive = market thinks team is stronger than our model predicts
      </p>
    </div>
  );
}
