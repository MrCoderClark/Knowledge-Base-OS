import { type NextRequest, NextResponse } from "next/server";
import { getActor } from "@/server/authz";
import { getVideo } from "@/server/kb/videos";
import { fileSize, readFileBuffer, readFileRange } from "@/server/storage";

/** Stream a video with HTTP Range support (seeking) — auth + org-scoped. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  const video = await getVideo(actor.orgId, id);
  if (!video?.fileKey) return new NextResponse("Not found", { status: 404 });

  const type = video.mimeType ?? "video/mp4";
  let size: number;
  try {
    size = await fileSize(video.fileKey);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }

  const range = req.headers.get("range");
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    const start = match ? parseInt(match[1], 10) : 0;
    const end =
      match && match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new NextResponse("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const buffer = await readFileRange(video.fileKey, start, end);
    return new NextResponse(new Uint8Array(buffer), {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Cache-Control": "private, no-store",
      },
    });
  }

  const buffer = await readFileBuffer(video.fileKey);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    },
  });
}
