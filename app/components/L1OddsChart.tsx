"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface OddsSnapshot {
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  impliedProb: { home: number; draw: number; away: number };
  bookmakerCount: number;
}

interface Props {
  odds: OddsSnapshot[];
  teamName: string;
}

export default function L1OddsChart({ odds, teamName }: Props) {
  if (odds.length === 0) return null;

  const chartData = odds.map((o) => {
    const isHome = o.homeTeam === teamName;
    const opponent = isHome ? o.awayTeam : o.homeTeam;
    const winProb = isHome ? o.impliedProb.home : o.impliedProb.away;
    const shortOpp = opponent.length > 12 ? opponent.substring(0, 12) + "…" : opponent;
    return {
      opponent: shortOpp,
      fullOpponent: opponent,
      winProb: Math.round(winProb * 1000) / 10,
      drawProb: Math.round(o.impliedProb.draw * 1000) / 10,
      isHome,
      kickoff: o.kickoff?.substring(0, 10),
    };
  });

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
        Implied Win Probability
      </div>
      <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
            <XAxis
              dataKey="opponent"
              tick={{ fontSize: 9, fill: "#888898" }}
              tickLine={false}
              axisLine={{ stroke: "#2a2a3a" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#888898" }}
              tickLine={false}
              axisLine={{ stroke: "#2a2a3a" }}
              width={35}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#111118",
                border: "1px solid #2a2a3a",
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "monospace",
              }}
              formatter={(value: any, _name: any, props: any) => [
                `${value}%`,
                `${props.payload.fullOpponent} (${props.payload.isHome ? "H" : "A"})`,
              ]}
            />
            <Bar dataKey="winProb" fill="#eab308" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
