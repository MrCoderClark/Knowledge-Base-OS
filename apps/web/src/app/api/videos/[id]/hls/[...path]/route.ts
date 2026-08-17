import { NextResponse } from "next/server";
import { getActor } from "@/server/authz";
import { getVideo } from "@/server/kb/videos";
import { readFileBuffer } from "@/server/storage";

function contentType(name: string): string {
  if (name.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (name.endsWith(".m4s")) return "video/iso.segment";
  if (name.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

/** Serve HLS manifests + segments for a video (auth + org-scoped). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> },
) {
  const { id, path } = await params;
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });

  // Reject any traversal in the requested sub-path.
  if (path.some((seg) => seg.includes("..") || seg.includes("/"))) {
    return new NextResponse("Bad path", { status: 400 });
  }

  const video = await getVideo(actor.orgId, id);
  if (!video?.hlsKey) return new NextResponse("Not found", { status: 404 });

  // hlsKey = videos/<org>/<asset>/hls/master.m3u8 → base = .../hls
  const base = video.hlsKey.slice(0, video.hlsKey.lastIndexOf("/"));
  const key = `${base}/${path.join("/")}`;

  let buffer: Buffer;
  try {
    buffer = await readFileBuffer(key);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType(path[path.length - 1] ?? ""),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
