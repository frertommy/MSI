import Link from "next/link";
import { notFound } from "next/navigation";
import { l3Source } from "@/lib/dataSources/l3";
import TeamTabs from "@/app/components/TeamTabs";
import L3PriceCard from "@/app/components/L3PriceCard";
import L3MarketChart from "@/app/components/L3MarketChart";

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  const ratings = l3Source.getRatings();
  return ratings.map((r) => ({ name: r.team }));
}

export default async function L3TeamPage({ params }: PageProps) {
  const { name } = await params;
  const teamName = decodeURIComponent(name);

  const detail = l3Source.getTeamDetail(teamName);
  if (!detail) notFound();

  const params3 = l3Source.getParams();
  const summary = l3Source.getSummary();
  const runShort = summary.latestRunId?.split("_").pop() ?? "—";

  // Find rank
  const allRatings = l3Source.getRatings();
  const rank = allRatings.findIndex((r) => r.team === teamName) + 1;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/l3"
        className="text-xs text-[var(--color-text-dim)] hover:text-[#10b981] transition-colors mb-6 inline-block"
      >
        &larr; Back to L3 Rankings
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight mb-1">{teamName}</h1>
        <p className="text-xs text-[var(--color-text-dim)] mb-2">
          {detail.league} &middot;{" "}
          <span className="text-[#10b981]">L3 Market Price</span> &middot;
          run: <span className="font-mono text-[#10b981]">{runShort}</span>
        </p>

        {/* Big numbers */}
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
              L3 Market Rating
            </div>
            <div className="text-4xl font-bold text-[#10b981] tabular-nums">
              {Math.round(detail.l3Rating)}
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
              ${detail.oraclePrice.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
              Market Premium
            </div>
            <div
              className={`text-2xl font-bold tabular-nums ${
                detail.premium > 0
                  ? "text-[var(--color-green)]"
                  : detail.premium < 0
                    ? "text-[var(--color-red)]"
                    : "text-[var(--color-text-dim)]"
              }`}
            >
              {detail.premium > 0 ? "+" : ""}
              {detail.premium.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <div>
            <span className="text-[var(--color-text-dim)]">Base ELO:</span>{" "}
            <span className="font-bold tabular-nums">{Math.round(detail.baseElo)}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">Market Consensus:</span>{" "}
            <span className="font-bold tabular-nums">{Math.round(detail.marketConsensus)}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">Confidence:</span>{" "}
            <span className="font-bold tabular-nums">{Math.round(detail.confidence * 100)}%</span>
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">Odds:</span>{" "}
            <span className="font-bold tabular-nums">{detail.components.matchCount} matches</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TeamTabs
        tabs={[
          {
            key: "l3",
            label: "L3 Market",
            color: "#10b981",
            content: <L3MarketChart data={detail.timeseries} mode="l3" />,
          },
          {
            key: "overlay",
            label: "L3 + Oracle",
            color: "#a78bfa",
            content: <L3MarketChart data={detail.timeseries} mode="overlay" />,
          },
          {
            key: "breakdown",
            label: "Breakdown",
            color: "#06b6d4",
            content: (
              <L3PriceCard
                l3Rating={detail.l3Rating}
                baseElo={detail.baseElo}
                marketConsensus={detail.marketConsensus}
                premium={detail.premium}
                oraclePrice={detail.oraclePrice}
                confidence={detail.confidence}
                components={detail.components}
                dataFreshness={detail.dataFreshness}
                timestamp={detail.timestamp}
              />
            ),
          },
          {
            key: "params",
            label: "Params",
            color: "#eab308",
            content: (
              <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
                  L3 Model Parameters
                </div>
                {params3 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <ParamItem label="Market Weight" value={params3.marketWeight} />
                    <ParamItem label="Base ELO Weight" value={params3.baseEloWeight} />
                    <ParamItem label="Match Decay (days)" value={params3.matchDecayDays} decimals={0} />
                    <ParamItem label="Oracle P₀" value={params3.oracle.P0} decimals={0} />
                    <ParamItem label="Oracle β" value={params3.oracle.beta} decimals={4} />
                    <ParamItem label="Oracle MSI₀" value={params3.oracle.MSI0} decimals={0} />
                  </div>
                )}
                <div className="mt-4 text-[10px] text-[var(--color-text-dim)] border-t border-[var(--color-border)]/50 pt-3 space-y-1">
                  <div>L3 = market_weight &times; market_consensus + base_weight &times; base_elo</div>
                  <div>market_consensus = weighted_avg(implied_rating_per_match)</div>
                  <div>implied_rating = opponent_elo + 400 &times; log₁₀(win_prob / (1 &minus; win_prob))</div>
                  <div>oracle_price = P₀ &times; exp(β &times; (L3 &minus; MSI₀))</div>
                </div>
              </div>
            ),
          },
        ]}
      />

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L3 Market-Derived &middot; {teamName} &middot; run: {runShort}
      </footer>
    </main>
  );
}

function ParamItem({
  label,
  value,
  decimals = 2,
}: {
  label: string;
  value: number | undefined;
  decimals?: number;
}) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--color-text-dim)]">{label}:</span>
      <span className="font-mono font-bold tabular-nums">{value.toFixed(decimals)}</span>
    </div>
  );
}
