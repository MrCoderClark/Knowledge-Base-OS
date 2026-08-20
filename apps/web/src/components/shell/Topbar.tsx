import { HelpCircle } from "lucide-react";
import { NotificationBell, type NotificationItem } from "./NotificationBell";
import { SearchPalette } from "./SearchPalette";
import { UserMenu } from "./UserMenu";

type Props = {
  user: { name: string | null; email: string };
  notifications?: NotificationItem[];
  unreadCount?: number;
};

export function Topbar({ user, notifications = [], unreadCount = 0 }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
      {/* Command-K search */}
      <SearchPalette />

      <div className="ml-auto flex items-center gap-1">
        <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-body hover:bg-nav-active hover:text-slate">
          <HelpCircle className="size-5" />
          Help
        </button>
        <NotificationBell items={notifications} unread={unreadCount} />
        <div className="ml-1">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
