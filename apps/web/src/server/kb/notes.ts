import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { lessonNotes } from "@/server/db/schema";

export type Note = {
  id: string;
  timestampSeconds: number;
  body: string;
  createdAt: Date;
};

/** A learner's notes on a video, ordered by their timestamp in the video. */
export function listNotes(userId: string, videoId: string): Promise<Note[]> {
  return db
    .select({
      id: lessonNotes.id,
      timestampSeconds: lessonNotes.timestampSeconds,
      body: lessonNotes.body,
      createdAt: lessonNotes.createdAt,
    })
    .from(lessonNotes)
    .where(and(eq(lessonNotes.userId, userId), eq(lessonNotes.videoId, videoId)))
    .orderBy(asc(lessonNotes.timestampSeconds));
}

export async function addNote(params: {
  userId: string;
  videoId: string;
  timestampSeconds: number;
  body: string;
}): Promise<Note> {
  const [row] = await db
    .insert(lessonNotes)
    .values(params)
    .returning({
      id: lessonNotes.id,
      timestampSeconds: lessonNotes.timestampSeconds,
      body: lessonNotes.body,
      createdAt: lessonNotes.createdAt,
    });
  return row;
}

export async function deleteNote(id: string, userId: string): Promise<void> {
  await db
    .delete(lessonNotes)
    .where(and(eq(lessonNotes.id, id), eq(lessonNotes.userId, userId)));
}
