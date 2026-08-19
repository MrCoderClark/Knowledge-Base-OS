import { type NextRequest, NextResponse } from "next/server";
import { getActor } from "@/server/authz";
import { upsertVideoProgress } from "@/server/kb/progress";
import { getVideo } from "@/server/kb/videos";

/**
 * Record a learner's position in a video. Called frequently by the player
 * (throttled fetch + a final `navigator.sendBeacon` on tab-hide), so it must
 * be cheap, idempotent, and org-scoped.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  // Confirm the video belongs to the actor's org before writing progress.
  const video = await getVideo(actor.orgId, id);
  if (!video) return new NextResponse("Not found", { status: 404 });

  let position = 0;
  let duration = 0;
  try {
    // sendBeacon posts a Blob; fetch posts JSON — req.json() handles both.
    const body = (await req.json()) as { position?: unknown; duration?: unknown };
    position = Number(body.position) || 0;
    duration = Number(body.duration) || 0;
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  await upsertVideoProgress({
    orgId: actor.orgId,
    userId: actor.userId,
    videoId: id,
    positionSeconds: position,
    durationSeconds: duration,
  });

  return new NextResponse(null, { status: 204 });
}
