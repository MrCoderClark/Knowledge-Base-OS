"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/server/authz";
import { markAllRead, markRead } from "./notifications";

export async function markAllNotificationsReadAction(): Promise<void> {
  const actor = await getActor();
  if (!actor) return;
  await markAllRead(actor.userId);
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const actor = await getActor();
  if (!actor) return;
  await markRead(id, actor.userId);
  revalidatePath("/", "layout");
}
