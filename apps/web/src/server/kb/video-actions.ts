"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/authz";
import type { VideoEditState } from "./kb-types";
import { deleteVideo, updateVideo } from "./videos";

export async function updateVideoAction(
  _prev: VideoEditState,
  formData: FormData,
): Promise<VideoEditState> {
  let actor;
  try {
    actor = await requirePermission("video:update");
  } catch {
    return { error: "You don't have permission to edit videos." };
  }
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryId = (formData.get("categoryId") as string) || null;
  if (!id) return { error: "Missing video." };
  if (!title) return { error: "A title is required." };

  await updateVideo({
    orgId: actor.orgId,
    id,
    title,
    description,
    categoryId,
    updatedBy: actor.userId,
  });
  revalidatePath(`/videos/${id}`);
  redirect(`/videos/${id}`);
}

export async function deleteVideoAction(id: string): Promise<void> {
  let actor;
  try {
    actor = await requirePermission("video:delete");
  } catch {
    return;
  }
  await deleteVideo({ orgId: actor.orgId, id });
  revalidatePath("/videos");
}
