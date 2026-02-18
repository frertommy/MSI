"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "v0", description: "Legacy" },
  { href: "/l1", label: "L1", description: "Facts" },
  { href: "/l2", label: "L2", description: "Derived" },
];

export default function NavMenu() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex items-center gap-1 border border-[var(--color-border)] rounded-md p-0.5 bg-[var(--color-bg-card)]">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-3 py-1.5 rounded text-xs transition-colors ${
            isActive(item.href)
              ? "bg-[var(--color-green)] text-[var(--color-bg)] font-bold"
              : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <span>{item.label}</span>
          <span className="hidden sm:inline ml-1 opacity-60 text-[10px]">
            {item.description}
          </span>
        </Link>
      ))}
    </nav>
  );
}
