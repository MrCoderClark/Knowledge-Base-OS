from faster_whisper import WhisperModel

from .config import settings

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        # int8 on CPU keeps memory/latency reasonable for dev.
        _model = WhisperModel(
            settings.whisper_model, device="cpu", compute_type="int8"
        )
    return _model


def _ts(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1_000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def transcribe(path: str) -> list[tuple[float, float, str]]:
    model = _get_model()
    segments, _info = model.transcribe(path, vad_filter=True)
    return [(seg.start, seg.end, seg.text.strip()) for seg in segments]


def build_vtt(segments: list[tuple[float, float, str]]) -> str:
    lines = ["WEBVTT", ""]
    for start, end, text in segments:
        if not text:
            continue
        lines.append(f"{_ts(start)} --> {_ts(end)}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def build_chapters(
    segments: list[tuple[float, float, str]],
    duration: float,
    count: int = 6,
) -> list[dict]:
    """Heuristic chapters: split the timeline into `count` slices, titling each
    from its first segment. (LLM-quality chapters come with the AI track.)"""
    if not segments:
        return []
    total = duration or segments[-1][1]
    step = max(1.0, total / count)
    chapters: list[dict] = []
    next_at = 0.0
    for start, _end, text in segments:
        if start >= next_at:
            words = text.split()
            title = " ".join(words[:6]) if words else "Chapter"
            chapters.append({"start": int(round(start)), "title": title})
            next_at += step
    return chapters
