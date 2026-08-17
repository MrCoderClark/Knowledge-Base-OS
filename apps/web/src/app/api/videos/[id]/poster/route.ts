import { NextResponse } from "next/server";
import { getActor } from "@/server/authz";
import { getVideo } from "@/server/kb/videos";
import { readFileBuffer } from "@/server/storage";

/** Serve a video's poster frame — auth + org-scoped. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const video = await getVideo(actor.orgId, id);
  if (!video?.posterKey) return new NextResponse("Not found", { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readFileBuffer(video.posterKey);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
