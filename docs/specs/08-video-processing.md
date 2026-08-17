# Spec 08 — Video Processing Pipeline (Design)

Status: **Design — awaiting sign-off** · Phase: 2 (media track) · Owner: TBD

Self-hosted video processing: transcode uploads for browser compatibility, produce
**HLS** for adaptive streaming, generate posters/thumbnails, and (later) transcribe for
captions/transcript/chapters. Realizes the Phase-2 "Python service + video processing"
from [`01-architecture.md`](./01-architecture.md).

Decision (2026-08-17): **self-host** (Python + ffmpeg), not a managed platform.

---

## 1. Why (situations this solves)

Phase-1 played the **original** uploaded file. That fails as video scales:
- **Compatibility** — `.mov`/odd codecs don't play everywhere → transcode to H.264 MP4.
- **Delivery/seeking** — streaming one big file is slow → **HLS** adaptive renditions.
- **Thumbnails** — reliable poster + hover-scrub sprites → ffmpeg frame extraction.
- **Training features** — captions, transcript, chapters, in-video search → transcription.

---

## 2. Architecture

```
Browser ─upload─► Next (route handler) ─┐
                                        ├─► store original (storage module)
                                        ├─► insert `jobs` row (queued) + video.status=processing
                                        └─► POST /jobs  ──HTTP (shared token)──► FastAPI
                                                                                  │ enqueue (RQ)
                                                                                  ▼
                                                                            Redis (broker)
                                                                                  │
                                                                            RQ worker(s)
                                                                            ├─ ffprobe (duration)
                                                                            ├─ ffmpeg → MP4 (H.264)
                                                                            ├─ ffmpeg → HLS renditions
                                                                            ├─ ffmpeg → poster + sprite
                                                                            └─ (2d) whisper → captions
                                                                                  │ write results
                                                                                  ▼
                                                             Postgres (video.status=ready, keys, duration)
                                                             + storage (hls/, poster.jpg, captions.vtt)

Browser ◄─HLS (m3u8 + segments)── Next route (auth + org-scoped) ◄─ storage
```

- **Shared infra:** the Python service and Next share the **same Postgres** (results) and
  **same Redis** (RQ broker — we already run Redis). **Storage** is the existing storage
  module (local FS now; swappable to object storage for multi-instance/scale).
- **Front door:** Next is the only thing the browser talks to. Next→FastAPI is
  server-to-server, authenticated with `AI_SERVICE_TOKEN`. FastAPI is also where the
  Phase-2 AI (`/chat`, transcription) will live.
- **Node can't enqueue RQ jobs directly** (RQ jobs are Python), so Next enqueues via the
  FastAPI HTTP endpoint; the `jobs` table is the source of truth for status/retries.

---

## 3. Data model changes

Reuse existing `videos` columns (`posterKey`, `durationSeconds`, `transcript`,
`status` enum already exist). Add:

- **`videos`**: `hls_key` (text, master playlist path), `sprite_key` (text),
  `captions_key` (text), `processing_error` (text), `chapters` (jsonb, 2d).
- **`jobs`** (new — the Phase-2 seam from spec 01, finally built):
  `id, org_id, type ('video_transcode' | 'video_transcribe'), target_type, target_id,
  status ('queued'|'running'|'done'|'failed'), attempts, error, created_at, updated_at`.

`video.status` flow: `uploaded → processing → ready | failed`.

---

## 4. Processing steps (worker)

1. **Probe** — `ffprobe` for duration, resolution, codec.
2. **MP4 (compat)** — `ffmpeg` H.264/AAC faststart MP4 (fallback + download).
3. **HLS** — `ffmpeg` renditions (e.g. 1080p/720p/480p/360p, capped at source) → per-
   rendition playlists + a master `m3u8`.
4. **Poster** — frame at ~10% (or a chosen time) → `poster.jpg` (downscaled).
5. **Sprite** *(2c)* — tiled thumbnails + WebVTT for scrub previews.
6. **Transcribe** *(2d)* — `faster-whisper` → `captions.vtt` + plain transcript +
   naive chapters.
7. Write keys + `duration_seconds` + `status='ready'` (or `failed` + `processing_error`).

**Security in the worker:** never build ffmpeg commands from shell strings — use argument
arrays (no `shell=True`); validate/whitelist inputs; run with time/size limits; write only
under the video's storage prefix.

---

## 5. Playback

- Once `ready`, the player loads **HLS** (`hls_key`) via Vidstack (built-in HLS). While
  `processing`, the UI shows a "Processing…" state; `failed` shows an error + retry (admin).
- **Serving:** a Next route streams the manifest + segments (auth + org-scoped), same as
  the current file route. Vidstack/hls.js fetch segments same-origin (cookie auth).
- **CSP:** hls.js uses a blob worker → add `worker-src 'self' blob:` and `media-src 'self'`
  to `src/proxy.ts`. Documented exception.

---

## 6. Python service (`apps/ai`)

```
apps/ai/
├─ pyproject.toml         # fastapi, uvicorn, rq, redis, psycopg, faster-whisper (2d), pydantic-settings
├─ app/
│  ├─ main.py             # FastAPI: POST /jobs (token-auth), GET /health
│  ├─ config.py           # env (DATABASE_URL, REDIS_URL, STORAGE_DIR, AI_SERVICE_TOKEN)
│  ├─ queue.py            # RQ queue
│  ├─ db.py               # psycopg to the shared Postgres
│  ├─ storage.py          # same key scheme as the TS storage module
│  ├─ jobs/transcode.py   # ffmpeg/ffprobe pipeline
│  └─ jobs/transcribe.py  # whisper (2d)
└─ worker.py              # RQ worker entrypoint
```

Runs as two processes: `uvicorn app.main:app` (API) and `rq worker` (jobs). ffmpeg must
be on PATH. Dev on Windows: Python 3.11+, ffmpeg binary, existing Redis.

---

## 7. Storage layout

```
videos/<orgId>/<videoId>/original.<ext>
                         /video.mp4
                         /hls/master.m3u8  + <rendition>/*.m3u8, *.ts
                         /poster.jpg
                         /sprite.jpg + sprite.vtt   (2c)
                         /captions.vtt              (2d)
```

---

## 8. Next ↔ Python contract

- **Enqueue:** on video upload, Next inserts the `jobs` row + sets `video.status=processing`,
  then `POST {AI_SERVICE_URL}/jobs` with `{ jobId, type, videoId, orgId }` and
  `Authorization: Bearer AI_SERVICE_TOKEN`. Non-blocking; failure leaves the job `queued`
  for a reconcile sweep.
- **Status:** the video page reads `video.status`; a light client poll (or revalidate)
  flips from "Processing…" to the player when `ready`.
- **Idempotency/retries:** `jobs.attempts`; a worker re-run overwrites outputs.

---

## 9. Environment (new)

| Var | Where | Purpose |
|---|---|---|
| `AI_SERVICE_URL` | Next | FastAPI base URL |
| `AI_SERVICE_TOKEN` | Next + AI | shared bearer token |
| `DATABASE_URL` | AI | shared Postgres |
| `REDIS_URL` | AI | RQ broker (shared) |
| `STORAGE_DIR` | AI | same storage root as Next |
| `WHISPER_MODEL` | AI | 2d (e.g. `base`/`small`) |

---

## 10. Phased implementation

- **2a — Foundations + transcode:** `jobs` table + `videos` columns; `apps/ai` scaffold
  (FastAPI + RQ + ffmpeg); enqueue on upload; probe duration + MP4 + poster; UI
  processing/ready/failed states; play MP4. *(commit)*
- **2b — HLS + adaptive playback:** renditions + master manifest; Next HLS serving route;
  Vidstack HLS; CSP `worker-src blob:`. *(commit)*
- **2c — Scrub thumbnails:** sprite + WebVTT. *(commit)*
- **2d — Transcription:** faster-whisper → captions + transcript + chapters; wire Vidstack
  captions + the Transcript/Chapters panels from `docs/Video.png`. *(commit)*
- **2e — (later)** feed transcripts into Phase-2 AI search/RAG (separate track).

Retire the client-side poster stopgap — the worker generates posters/duration reliably.

---

## 11. Prerequisites (dev)

- **Python 3.11+** and **ffmpeg/ffprobe** on PATH (Windows: download the ffmpeg build).
- Redis running (already have it).
- `AI_SERVICE_TOKEN` generated; `AI_SERVICE_URL=http://127.0.0.1:8000`.

## 12. Known limitations / production notes

- Local-FS HLS works single-server; multi-instance/CDN needs object storage (storage
  module already abstracts this).
- Whisper on CPU is slow; a GPU or a smaller model is recommended for volume.
- Transcode is CPU-heavy — size the worker(s) accordingly; long videos take minutes.
