import { db } from "@/server/db";
import { jobs } from "@/server/db/schema";
import { enqueueAiJob } from "@/server/ai/client";

/** Queue a transcode job for a video and notify the media service. */
export async function enqueueVideoTranscode(
  orgId: string,
  videoId: string,
): Promise<void> {
  const [job] = await db
    .insert(jobs)
    .values({
      orgId,
      type: "video_transcode",
      targetId: videoId,
      status: "queued",
    })
    .returning({ id: jobs.id });

  await enqueueAiJob(job.id, "video_transcode");
}
