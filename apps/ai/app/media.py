import json
import math
import os
import subprocess

# ffmpeg/ffprobe are always invoked with argument arrays (never a shell) to
# avoid command injection. Each call is bounded by a timeout.
PROBE_TIMEOUT = 120
TRANSCODE_TIMEOUT = 60 * 60  # 1h hard cap per job

# Adaptive ladder: (height, width, video kbps). Renditions above the source
# resolution are skipped (no upscaling).
HLS_LADDER = [
    (1080, 1920, 5000),
    (720, 1280, 2800),
    (480, 854, 1400),
    (360, 640, 800),
]


def probe_duration(path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", path],
        capture_output=True,
        text=True,
        check=True,
        timeout=PROBE_TIMEOUT,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def transcode_mp4(src: str, dst: str) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-i", src,
         "-c:v", "libx264", "-preset", "medium", "-crf", "23",
         "-c:a", "aac", "-b:a", "128k",
         "-movflags", "+faststart", dst],
        check=True,
        timeout=TRANSCODE_TIMEOUT,
    )


def poster(src: str, dst: str, at_seconds: float) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(at_seconds), "-i", src,
         "-frames:v", "1", "-vf", "scale=640:-2", dst],
        check=True,
        timeout=PROBE_TIMEOUT,
    )


def probe_height(path: str) -> int:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=height", "-of", "json", path],
        capture_output=True, text=True, check=True, timeout=PROBE_TIMEOUT,
    )
    streams = json.loads(result.stdout).get("streams", [])
    return int(streams[0]["height"]) if streams else 0


def transcode_hls(src: str, out_dir: str, source_height: int) -> None:
    """
    Produce a fMP4/CMAF HLS rendition ladder (capped at the source height) plus
    a hand-written master playlist. Each rendition is a simple, robust ffmpeg
    call; outputs land in out_dir/v{i}/ with a master.m3u8 at the root.
    """
    renditions = [r for r in HLS_LADDER if r[0] <= source_height] or [HLS_LADDER[-1]]
    variants = []  # (relative playlist uri, bandwidth, width, height)

    src_abs = os.path.abspath(src)
    for i, (height, width, v_kbps) in enumerate(renditions):
        vdir = os.path.join(out_dir, f"v{i}")
        os.makedirs(vdir, exist_ok=True)
        # Run with cwd=vdir + relative output names so the fMP4 init segment
        # (default "init.mp4") lands in this folder alongside the segments.
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_abs,
             "-vf",
             f"scale=w={width}:h={height}:force_original_aspect_ratio=decrease,"
             f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black",
             "-c:v", "libx264", "-preset", "veryfast",
             "-b:v", f"{v_kbps}k", "-maxrate", f"{int(v_kbps * 1.07)}k",
             "-bufsize", f"{v_kbps * 2}k",
             "-c:a", "aac", "-b:a", "128k", "-ac", "2",
             "-hls_time", "6", "-hls_playlist_type", "vod",
             "-hls_segment_type", "fmp4", "-hls_flags", "independent_segments",
             "-hls_fmp4_init_filename", "init.mp4",
             "-hls_segment_filename", "seg_%03d.m4s",
             "playlist.m3u8"],
            check=True, timeout=TRANSCODE_TIMEOUT, cwd=vdir,
        )
        variants.append((f"v{i}/playlist.m3u8", v_kbps * 1000 + 128000, width, height))

    lines = ["#EXTM3U", "#EXT-X-VERSION:7"]
    for uri, bandwidth, width, height in variants:
        lines.append(
            f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},RESOLUTION={width}x{height}"
        )
        lines.append(uri)
    with open(os.path.join(out_dir, "master.m3u8"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


_SPRITE_COLS = 10
_SPRITE_W = 160
_SPRITE_H = 90


def _vtt_ts(seconds: int) -> str:
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}.000"


def sprite(src: str, out_dir: str, duration: float) -> None:
    """
    A single tiled sprite sheet (160x90 thumbs, 10 wide) + a WebVTT that maps
    time ranges to sprite regions, for timeline hover-preview.
    """
    total = int(duration)
    interval = max(2, math.ceil(total / 100)) if total > 0 else 2
    count = max(1, total // interval + 1)
    rows = math.ceil(count / _SPRITE_COLS)

    subprocess.run(
        ["ffmpeg", "-y", "-i", os.path.abspath(src),
         "-vf",
         f"fps=1/{interval},scale={_SPRITE_W}:{_SPRITE_H},"
         f"tile={_SPRITE_COLS}x{rows}",
         "-frames:v", "1", os.path.join(out_dir, "sprite.jpg")],
        check=True, timeout=TRANSCODE_TIMEOUT,
    )

    lines = ["WEBVTT", ""]
    for i in range(count):
        start = i * interval
        end = min((i + 1) * interval, total) if total > 0 else interval
        x = (i % _SPRITE_COLS) * _SPRITE_W
        y = (i // _SPRITE_COLS) * _SPRITE_H
        lines.append(f"{_vtt_ts(start)} --> {_vtt_ts(end)}")
        lines.append(f"sprite.jpg#xywh={x},{y},{_SPRITE_W},{_SPRITE_H}")
        lines.append("")
    with open(os.path.join(out_dir, "sprite.vtt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
