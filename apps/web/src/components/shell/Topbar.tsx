import { Bell, HelpCircle, Search } from "lucide-react";
import { UserMenu } from "./UserMenu";

type Props = {
  user: { name: string | null; email: string };
};

export function Topbar({ user }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
      {/* Command-K search (visual for now; wired in the Search feature) */}
      <div className="relative max-w-2xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search documents, videos, procedures, and training…"
          className="h-10 w-full rounded-lg border border-border bg-canvas pl-10 pr-16 text-body-md text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-xs font-medium text-muted">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-body hover:bg-nav-active hover:text-slate">
          <HelpCircle className="size-5" />
          Help
        </button>
        <button
          aria-label="Notifications"
          className="rounded-md p-2 text-body hover:bg-nav-active hover:text-slate"
        >
          <Bell className="size-5" />
        </button>
        <div className="ml-1">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
