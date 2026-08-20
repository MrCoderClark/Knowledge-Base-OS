"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { footerNav, primaryNav, type NavItem } from "./nav";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-body-md transition-colors",
        active
          ? "bg-nav-active font-medium text-slate"
          : "text-body hover:bg-nav-active hover:text-slate",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo" />
      )}
      <Icon className="size-5 shrink-0" strokeWidth={2} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({
  allowed,
  canCreateDoc,
}: {
  allowed: string[];
  canCreateDoc: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const visible = new Set(allowed);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-slate text-sm font-bold text-white">
          K
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold text-heading">KnowledgeOS</div>
          <div className="text-xs text-muted">Enterprise Hub</div>
        </div>
      </div>

      {/* Primary action */}
      {canCreateDoc && (
        <div className="px-4 pb-2">
          <Link
            href="/documents/new"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            New Document
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {primaryNav
          .filter((item) => visible.has(item.href))
          .map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
      </nav>

      {/* Footer nav */}
      <div className="space-y-1 border-t border-border px-4 py-4">
        {footerNav
          .filter((item) => visible.has(item.href))
          .map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
      </div>
    </aside>
  );
}
