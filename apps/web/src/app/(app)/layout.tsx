import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { footerNav, primaryNav } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { can, getActor } from "@/server/authz";
import { getCurrentSession } from "@/server/auth/session";
import { listNotifications, unreadCount } from "@/server/kb/notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) {
    const path = (await headers()).get("x-pathname") || "/";
    redirect(`/signin?next=${encodeURIComponent(path)}`);
  }

  const actor = await getActor();
  const [notifications, unread] = actor
    ? await Promise.all([
        listNotifications(actor.userId),
        unreadCount(actor.userId),
      ])
    : [[], 0];

  // Nav items visible to this user (by role or granted permission).
  const allowed = [...primaryNav, ...footerNav]
    .filter((i) => !i.permission || (actor != null && can(actor, i.permission)))
    .map((i) => i.href);
  const canCreateDoc = actor != null && can(actor, "document:create");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar allowed={allowed} canCreateDoc={canCreateDoc} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={session.user}
          notifications={notifications}
          unreadCount={unread}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
