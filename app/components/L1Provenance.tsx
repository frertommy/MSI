"use client";

import { useState } from "react";

interface ProvenanceEntry {
  source: string;
  files: { name: string; size: number }[];
}

interface Props {
  provenance: ProvenanceEntry[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function L1Provenance({ provenance }: Props) {
  const [expanded, setExpanded] = useState(false);

  const totalFiles = provenance.reduce((s, p) => s + p.files.length, 0);
  if (totalFiles === 0) return null;

  return (
    <div className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors cursor-pointer mb-2"
      >
        <span>{expanded ? "▼" : "▶"}</span>
        <span>Provenance ({totalFiles} raw files)</span>
      </button>
      {expanded && (
        <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4 space-y-3">
          {provenance.map((p) => (
            <div key={p.source}>
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
                {p.source} ({p.files.length})
              </div>
              {p.files.length > 0 ? (
                <div className="space-y-0.5">
                  {p.files.map((f) => (
                    <div key={f.name} className="text-[10px] font-mono text-[var(--color-text-dim)] flex gap-2">
                      <span className="text-[var(--color-text)]">{f.name}</span>
                      <span>{formatSize(f.size)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-[var(--color-text-dim)]">No files</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
