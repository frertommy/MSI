"use client";

const LAYERS = [
  { key: "baseElo", label: "Match Data", color: "#22c55e", comingSoon: false },
  { key: "eloOdds", label: "Match + Odds", color: "#eab308", comingSoon: false },
  { key: "eloOddsInjuries", label: "+ Injuries", color: "#f97316", comingSoon: true },
  { key: "eloOddsInjuriesNews", label: "Full Signal", color: "#ef4444", comingSoon: true },
];

interface LayerToggleProps {
  selected: string;
  onSelect: (key: string) => void;
}

export default function LayerToggle({ selected, onSelect }: LayerToggleProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] self-center mr-1">
        Signal:
      </span>
      {LAYERS.map((l) => (
        <button
          key={l.key}
          onClick={() => !l.comingSoon && onSelect(l.key)}
          className={`px-2 py-1 text-[10px] rounded border transition-colors ${
            l.comingSoon
              ? "border-[var(--color-border)] text-[var(--color-text-dim)] opacity-40 cursor-default"
              : selected === l.key
                ? "border-current bg-current/10 cursor-pointer"
                : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] cursor-pointer"
          }`}
          style={
            !l.comingSoon && selected === l.key
              ? { color: l.color }
              : undefined
          }
        >
          {l.label}
          {l.comingSoon && " (soon)"}
        </button>
      ))}
    </div>
  );
}
