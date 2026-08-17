import { env } from "@/server/env";

/**
 * Fire a job at the media/AI service. Best-effort: if the service is
 * unreachable the job row stays `queued` for a later reconcile sweep, so
 * uploads never fail because processing is down.
 */
export async function enqueueAiJob(jobId: string, type: string): Promise<void> {
  try {
    const res = await fetch(`${env.AI_SERVICE_URL}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ jobId, type }),
    });
    if (!res.ok) {
      console.error("[ai] enqueue failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[ai] enqueue error", err);
  }
}
