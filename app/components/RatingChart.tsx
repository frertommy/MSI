"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  date: string;
  rating: number;
}

interface RatingChartProps {
  data: DataPoint[];
}

const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "All", months: 0 },
];

export default function RatingChart({ data }: RatingChartProps) {
  const [range, setRange] = useState("All");

  const filtered = useMemo(() => {
    if (range === "All" || data.length === 0) return data;
    const r = RANGES.find((r) => r.label === range);
    if (!r || r.months === 0) return data;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - r.months);
    const cutoffStr = cutoff.toISOString().substring(0, 10);
    return data.filter((d) => d.date >= cutoffStr);
  }, [data, range]);

  if (data.length === 0) return null;

  const ratings = filtered.map((d) => d.rating);
  const minR = Math.floor(Math.min(...ratings) / 10) * 10 - 20;
  const maxR = Math.ceil(Math.max(...ratings) / 10) * 10 + 20;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          Rating History
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors cursor-pointer ${
                range === r.label
                  ? "border-[var(--color-green)] text-[var(--color-green)] bg-[var(--color-green)]/10"
                  : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={filtered}>
            <defs>
              <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#2a2a3a"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#888898" }}
              tickLine={false}
              axisLine={{ stroke: "#2a2a3a" }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.toLocaleString("default", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
              }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[minR, maxR]}
              tick={{ fontSize: 10, fill: "#888898" }}
              tickLine={false}
              axisLine={{ stroke: "#2a2a3a" }}
              width={45}
            />
            <Tooltip
              contentStyle={{
                background: "#111118",
                border: "1px solid #2a2a3a",
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "monospace",
              }}
              labelStyle={{ color: "#888898" }}
              formatter={(value: number | undefined) => [
                value != null ? Math.round(value) : 0,
                "MSI Rating",
              ]}
            />
            <Area
              type="monotone"
              dataKey="rating"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#ratingGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#22c55e" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
