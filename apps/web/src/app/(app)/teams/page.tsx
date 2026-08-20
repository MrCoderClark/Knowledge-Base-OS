import { UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { can, getActor } from "@/server/authz";
import { listOrgMembers } from "@/server/kb/members";
import { listTeamsDetailed } from "@/server/kb/teams";
import { TeamsManager } from "./TeamsManager";

export default async function TeamsPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!can(actor, "team:manage")) redirect("/");

  const [teams, members] = await Promise.all([
    listTeamsDetailed(actor.orgId),
    listOrgMembers(actor.orgId),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-[32px] font-semibold leading-tight tracking-tight text-heading">
          <UsersRound className="size-7 text-indigo" />
          Teams
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Group people into teams to assign training to everyone at once.
        </p>
      </header>

      <TeamsManager
        teams={teams}
        allMembers={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
        }))}
      />
    </div>
  );
}
