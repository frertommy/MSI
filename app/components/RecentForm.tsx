interface FormMatch {
  date: string;
  opponent: string;
  homeAway: "H" | "A";
  score: string;
  result: "W" | "D" | "L";
  ratingChange: number;
}

interface RecentFormProps {
  matches: FormMatch[];
}

const resultColors: Record<string, string> = {
  W: "text-[var(--color-green)] bg-[var(--color-green)]/10 border-[var(--color-green)]/30",
  D: "text-[var(--color-yellow)] bg-[var(--color-yellow)]/10 border-[var(--color-yellow)]/30",
  L: "text-[var(--color-red)] bg-[var(--color-red)]/10 border-[var(--color-red)]/30",
};

export default function RecentForm({ matches }: RecentFormProps) {
  return (
    <div className="mb-8">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
        Recent Form (Last 10)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
              <th className="text-left py-2 px-2">Date</th>
              <th className="text-left py-2 px-2">Opponent</th>
              <th className="text-center py-2 px-2 w-10">H/A</th>
              <th className="text-center py-2 px-2 w-14">Score</th>
              <th className="text-center py-2 px-2 w-10">Res</th>
              <th className="text-right py-2 px-2 w-16">Δ Rating</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <tr
                key={i}
                className="border-b border-[var(--color-border)]/50"
              >
                <td className="py-1.5 px-2 text-[var(--color-text-dim)] tabular-nums">
                  {m.date}
                </td>
                <td className="py-1.5 px-2">{m.opponent}</td>
                <td className="py-1.5 px-2 text-center text-[var(--color-text-dim)]">
                  {m.homeAway}
                </td>
                <td className="py-1.5 px-2 text-center tabular-nums">
                  {m.score}
                </td>
                <td className="py-1.5 px-2 text-center">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${resultColors[m.result]}`}
                  >
                    {m.result}
                  </span>
                </td>
                <td
                  className={`py-1.5 px-2 text-right tabular-nums font-medium ${
                    m.ratingChange >= 0
                      ? "text-[var(--color-green)]"
                      : "text-[var(--color-red)]"
                  }`}
                >
                  {m.ratingChange >= 0 ? "+" : ""}
                  {m.ratingChange.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
