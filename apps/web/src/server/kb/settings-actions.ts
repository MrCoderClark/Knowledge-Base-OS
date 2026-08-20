"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/authz";
import { slugify } from "./categories";
import { slugTaken, updateOrg } from "./org";

export async function updateOrgSettingsAction(
  name: string,
  slug: string,
): Promise<{ ok?: true; error?: string }> {
  let actor;
  try {
    actor = await requirePermission("settings:manage");
  } catch {
    return { error: "You don't have permission to manage settings." };
  }

  const n = name.trim();
  if (!n) return { error: "Organization name is required." };

  const s = slugify(slug.trim() || n);
  if (!s) return { error: "Enter a valid workspace URL." };
  if (await slugTaken(s, actor.orgId)) {
    return { error: "That workspace URL is already taken." };
  }

  await updateOrg(actor.orgId, n.slice(0, 200), s);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
