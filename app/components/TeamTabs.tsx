"use client";

import { useState, ReactNode } from "react";

interface Tab {
  key: string;
  label: string;
  color: string;
  content: ReactNode;
}

interface TeamTabsProps {
  tabs: Tab[];
}

export default function TeamTabs({ tabs }: TeamTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "");

  if (tabs.length === 0) return null;

  const activeColor =
    tabs.find((t) => t.key === activeTab)?.color ?? "#888898";

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded border transition-colors cursor-pointer ${
              activeTab === tab.key
                ? "border-current bg-current/10"
                : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
            style={
              activeTab === tab.key ? { color: tab.color } : undefined
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>
        {tabs.map((tab) => (
          <div key={tab.key} className={activeTab === tab.key ? "" : "hidden"}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
