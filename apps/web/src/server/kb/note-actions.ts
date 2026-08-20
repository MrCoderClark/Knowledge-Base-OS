"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/server/authz";
import { addNote, deleteNote, type Note } from "./notes";
import { getVideo } from "./videos";

export async function addNoteAction(
  videoId: string,
  timestampSeconds: number,
  body: string,
): Promise<{ ok?: Note; error?: string }> {
  const actor = await getActor();
  if (!actor) return { error: "Please sign in." };
  const video = await getVideo(actor.orgId, videoId);
  if (!video) return { error: "Video not found." };

  const text = body.trim();
  if (!text) return { error: "Write a note first." };

  const note = await addNote({
    userId: actor.userId,
    videoId,
    timestampSeconds: Math.max(0, Math.floor(timestampSeconds)),
    body: text.slice(0, 2000),
  });
  revalidatePath(`/videos/${videoId}`);
  return { ok: note };
}

export async function deleteNoteAction(
  id: string,
  videoId: string,
): Promise<void> {
  const actor = await getActor();
  if (!actor) return;
  await deleteNote(id, actor.userId);
  revalidatePath(`/videos/${videoId}`);
}
