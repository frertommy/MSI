import Link from "next/link";
import { notFound } from "next/navigation";
import { l2Source } from "@/lib/dataSources/l2";
import TeamTabs from "@/app/components/TeamTabs";
import L2MSIChart from "@/app/components/L2MSIChart";
import L2DiffView from "@/app/components/L2DiffView";
import L2MSIOracleOverlayChart from "@/app/components/L2MSIOracleOverlayChart";

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  const teams = l2Source.getTeams();
  return teams.map((t) => ({ name: t.name }));
}

export default async function L2TeamPage({ params }: PageProps) {
  const { name } = await params;
  const teamName = decodeURIComponent(name);

  const derived = l2Source.getTeamDerived(teamName);
  if (!derived) notFound();

  const modelParams = l2Source.getModelParams();
  const summary = l2Source.getSummary();
  const runShort = summary.latestRunId?.split("_").pop() ?? "—";

  // Find rank in the full ratings list
  const allRatings = l2Source.getMSIRatings();
  const rank = allRatings.findIndex((r) => r.team === teamName) + 1;

  const totalDelta = derived.msiFinal - derived.msiBase;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/l2"
        className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-green)] transition-colors mb-6 inline-block"
      >
        &larr; Back to L2 Rankings
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight mb-1">{teamName}</h1>
        <p className="text-xs text-[var(--color-text-dim)] mb-2">
          {derived.league} &middot;{" "}
          <span className="text-[var(--color-green)]">L2 Derived</span> &middot;
          run: <span className="font-mono text-[var(--color-green)]">{runShort}</span>
        </p>

        {/* Big numbers */}
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
              MSI Final
            </div>
            <div className="text-4xl font-bold text-[var(--color-green)] tabular-nums">
              {Math.round(derived.msiFinal)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
              Rank
            </div>
            <div className="text-2xl font-bold tabular-nums">#{rank}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
              Oracle Price
            </div>
            <div className="text-2xl font-bold tabular-nums text-[var(--color-yellow)]">
              {derived.oraclePrice ? `$${derived.oraclePrice.toFixed(2)}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
              Confidence
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {(derived.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Rating breakdown */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <div>
            <span className="text-[var(--color-text-dim)]">Base:</span>{" "}
            <span className="font-bold tabular-nums">{Math.round(derived.msiBase)}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">Odds Adj:</span>{" "}
            <span
              className={`font-bold tabular-nums ${
                derived.oddsAdjustment > 0
                  ? "text-[var(--color-green)]"
                  : derived.oddsAdjustment < 0
                    ? "text-[var(--color-red)]"
                    : "text-[var(--color-text-dim)]"
              }`}
            >
              {derived.oddsAdjustment > 0 ? "+" : ""}
              {derived.oddsAdjustment.toFixed(1)}
            </span>
          </div>
          {derived.injuryAdjustment !== 0 && (
            <div>
              <span className="text-[var(--color-text-dim)]">Injury:</span>{" "}
              <span className="font-bold tabular-nums text-[#f97316]">
                {derived.injuryAdjustment.toFixed(1)}
              </span>
            </div>
          )}
          {derived.newsAdjustment !== 0 && (
            <div>
              <span className="text-[var(--color-text-dim)]">News:</span>{" "}
              <span
                className={`font-bold tabular-nums ${
                  derived.newsAdjustment > 0 ? "text-[var(--color-green)]" : "text-[#ef4444]"
                }`}
              >
                {derived.newsAdjustment > 0 ? "+" : ""}
                {derived.newsAdjustment.toFixed(1)}
              </span>
            </div>
          )}
          <div>
            <span className="text-[var(--color-text-dim)]">Δ Total:</span>{" "}
            <span
              className={`font-bold tabular-nums ${
                totalDelta > 0
                  ? "text-[var(--color-green)]"
                  : totalDelta < 0
                    ? "text-[var(--color-red)]"
                    : "text-[var(--color-text-dim)]"
              }`}
            >
              {totalDelta > 0 ? "+" : ""}
              {totalDelta.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TeamTabs
        tabs={[
          {
            key: "msi",
            label: "MSI",
            color: "#22c55e",
            content: (
              <L2MSIChart data={derived.timeseries} />
            ),
          },
          {
            key: "overlay",
            label: "MSI + Oracle",
            color: "#a78bfa",
            content: (
              <L2MSIOracleOverlayChart
                data={derived.timeseries}
                oracleParams={modelParams?.oracle}
                currentOraclePrice={derived.oraclePrice}
              />
            ),
          },
          {
            key: "diff",
            label: "Diff View",
            color: "#eab308",
            content: (
              <L2DiffView
                msiBase={derived.msiBase}
                msiOdds={derived.msiOdds}
                msiFinal={derived.msiFinal}
                oddsAdjustment={derived.oddsAdjustment}
                injuryAdjustment={derived.injuryAdjustment}
                newsAdjustment={derived.newsAdjustment}
                oraclePrice={derived.oraclePrice}
                confidence={derived.confidence}
                explainJson={derived.explainJson}
                timeseries={derived.timeseries}
              />
            ),
          },
          {
            key: "oracle",
            label: "Oracle",
            color: "#a855f7",
            content: (
              <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
                  Oracle Price Mapping
                </div>
                <div className="flex flex-wrap gap-6 mb-4">
                  <div>
                    <div className="text-[10px] text-[var(--color-text-dim)] mb-1">Oracle Price</div>
                    <div className="text-2xl font-bold tabular-nums text-[var(--color-yellow)]">
                      {derived.oraclePrice ? `$${derived.oraclePrice.toFixed(2)}` : "—"}
                    </div>
                  </div>
                  {derived.oracleConfidence != null && (
                    <div>
                      <div className="text-[10px] text-[var(--color-text-dim)] mb-1">Oracle Confidence</div>
                      <div className="text-2xl font-bold tabular-nums">
                        {(derived.oracleConfidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>
                {modelParams && (
                  <div className="border-t border-[var(--color-border)]/50 pt-3">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
                      Model Parameters
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      {modelParams.oracle && (
                        <>
                          <ParamItem label="P₀" value={modelParams.oracle.P0} />
                          <ParamItem label="β" value={modelParams.oracle.beta} decimals={4} />
                          <ParamItem label="MSI₀" value={modelParams.oracle.MSI0} />
                        </>
                      )}
                      <ParamItem label="K Factor" value={modelParams.K} />
                      <ParamItem label="Home Adv" value={modelParams.homeAdvantage} />
                      <ParamItem label="Odds Blend" value={modelParams.oddsBlendWeight} />
                      <ParamItem label="Odds Live" value={modelParams.oddsLiveWeight} />
                      <ParamItem label="Season Reg" value={modelParams.seasonRegression} />
                    </div>
                  </div>
                )}
                <div className="mt-4 text-[10px] text-[var(--color-text-dim)] border-t border-[var(--color-border)]/50 pt-3">
                  Formula: oracle_price = P₀ &times; exp(β &times; (MSI_final &minus; MSI₀))
                </div>
              </div>
            ),
          },
          {
            key: "explain",
            label: "Explain",
            color: "#06b6d4",
            content: (
              <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
                  Explain JSON
                </div>
                {Object.keys(derived.explainJson).length > 0 ? (
                  <div className="space-y-1.5">
                    {Object.entries(derived.explainJson).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2 text-xs border-b border-[var(--color-border)]/30 py-1.5">
                        <span className="text-[var(--color-text-dim)] font-mono text-[10px] min-w-[140px]">
                          {key}
                        </span>
                        <span className="font-mono text-[var(--color-text)]">
                          {typeof val === "number"
                            ? val.toFixed(4)
                            : typeof val === "object"
                              ? JSON.stringify(val)
                              : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-dim)]">
                    No explain data available for this team.
                  </p>
                )}
              </div>
            ),
          },
          ...(derived.nextFixture
            ? [
                {
                  key: "next",
                  label: "Next Match",
                  color: "#f97316",
                  content: (
                    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
                        Next Fixture
                      </div>
                      <div className="flex flex-wrap gap-6 text-xs">
                        <div>
                          <div className="text-[10px] text-[var(--color-text-dim)] mb-1">Opponent</div>
                          <div className="text-base font-bold">{derived.nextFixture.opponent}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--color-text-dim)] mb-1">Date</div>
                          <div className="tabular-nums">{derived.nextFixture.date}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--color-text-dim)] mb-1">Venue</div>
                          <div>{derived.nextFixture.isHome ? "Home" : "Away"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--color-text-dim)] mb-1">Market Win %</div>
                          <div className="font-bold tabular-nums text-[var(--color-yellow)]">
                            {(derived.nextFixture.marketWinProb * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--color-text-dim)] mb-1">Predicted Win %</div>
                          <div className="font-bold tabular-nums text-[var(--color-green)]">
                            {(derived.nextFixture.predictedWinProb * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L2 Derived &middot; {teamName} &middot; run: {runShort}
      </footer>
    </main>
  );
}

function ParamItem({
  label,
  value,
  decimals = 1,
}: {
  label: string;
  value: number | undefined;
  decimals?: number;
}) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--color-text-dim)]">{label}:</span>
      <span className="font-mono font-bold tabular-nums">
        {typeof value === "number" ? value.toFixed(decimals) : String(value)}
      </span>
    </div>
  );
}
