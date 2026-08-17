import { NextResponse } from "next/server";
import { getActor } from "@/server/authz";
import { getVideo } from "@/server/kb/videos";
import { readFileBuffer } from "@/server/storage";

/** Serve a video's caption track (WebVTT) — auth + org-scoped. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const video = await getVideo(actor.orgId, id);
  if (!video?.captionsKey) return new NextResponse("Not found", { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readFileBuffer(video.captionsKey);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(buffer.toString("utf8"), {
    headers: { "Content-Type": "text/vtt", "Cache-Control": "no-store" },
  });
}
