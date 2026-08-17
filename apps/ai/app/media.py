import json
import subprocess

# ffmpeg/ffprobe are always invoked with argument arrays (never a shell) to
# avoid command injection. Each call is bounded by a timeout.
PROBE_TIMEOUT = 120
TRANSCODE_TIMEOUT = 60 * 60  # 1h hard cap per job


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
