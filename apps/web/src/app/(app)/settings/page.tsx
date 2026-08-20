import { Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { can, getActor } from "@/server/authz";
import { getOrg } from "@/server/kb/org";
import { OrgSettingsForm } from "./OrgSettingsForm";

export default async function SettingsPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!can(actor, "settings:manage")) redirect("/");

  const org = await getOrg(actor.orgId);

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-[32px] font-semibold leading-tight tracking-tight text-heading">
          <Settings className="size-7 text-indigo" />
          Settings
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Manage your organization.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-heading">Organization</h2>
        <OrgSettingsForm name={org?.name ?? ""} slug={org?.slug ?? ""} />
      </section>
    </div>
  );
}
