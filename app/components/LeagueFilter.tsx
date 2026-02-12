"use client";

const LEAGUES = [
  { code: "ALL", label: "All" },
  { code: "PL", label: "Premier League" },
  { code: "PD", label: "La Liga" },
  { code: "BL1", label: "Bundesliga" },
  { code: "SA", label: "Serie A" },
  { code: "FL1", label: "Ligue 1" },
];

interface LeagueFilterProps {
  selected: string;
  onSelect: (code: string) => void;
}

export default function LeagueFilter({
  selected,
  onSelect,
}: LeagueFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {LEAGUES.map((l) => (
        <button
          key={l.code}
          onClick={() => onSelect(l.code)}
          className={`px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer ${
            selected === l.code
              ? "border-[var(--color-green)] text-[var(--color-green)] bg-[var(--color-green)]/10"
              : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
