# Spec 08 — Video Processing Pipeline (Design)

Status: **Design — building** · Phase: 2 (media track) · Owner: TBD

Production-grade, **self-hosted, 100% free/OSS** video pipeline: transcode uploads for
compatibility, produce **adaptive HLS**, generate posters/sprites, and (later) transcribe
for captions/transcript/chapters. Realizes the Phase-2 media service from
[`01-architecture.md`](./01-architecture.md).

Decisions (2026-08-17): **self-host**; **Celery + RabbitMQ**; **MinIO** (S3-compatible)
object storage; everything **containerized (Docker Compose)** for prod parity.

---

## 1. Architecture

```
Browser ─upload─► Next (route handler)
                    ├─ PUT original ─────────────► MinIO (S3)      [apps/web storage → S3]
                    ├─ INSERT jobs(queued) + video.status=processing (Postgres)
                    └─ POST /jobs {jobId} ──HTTP(Bearer)──► FastAPI (apps/ai)
                                                              │ celery_task.delay(jobId)
                                                              ▼
                                                          RabbitMQ (broker)
                                                              │
                                                       Celery worker(s)  [ffmpeg]
                                                       ├─ GET original ◄─ MinIO
                                                       ├─ ffprobe → duration
                                                       ├─ ffmpeg → MP4 (H.264/AAC)
                                                       ├─ ffmpeg → HLS renditions (2b)
                                                       ├─ ffmpeg → poster (+ sprite 2c)
                                                       ├─ whisper → captions (2d)
                                                       ├─ PUT outputs ─► MinIO
                                                       └─ UPDATE videos(keys,duration,ready)
                                                                 + jobs(done|failed)  (Postgres)

Browser ◄─ signed URL / stream ── Next route (auth + org-scoped) ── MinIO
```

- **Shared state:** Next and the worker share the **same Neon Postgres** (`jobs` +
  `videos` are the source of truth Next reads) and the **same MinIO bucket**.
- **Front door:** the browser only talks to Next. Next→FastAPI is server-to-server,
  `Authorization: Bearer AI_SERVICE_TOKEN`. FastAPI later also hosts AI `/chat`.
- **Why Celery+RabbitMQ:** durable queues, acks, retries+backoff, dead-letter,
  concurrency/priorities, Flower monitoring — the right posture for long transcode jobs.
  (RQ was rejected: `os.fork` dependency; DB-polling rejected: not a real queue.)

---

## 2. Data model

Reuse existing `videos` columns (`poster_key`, `duration_seconds`, `transcript`,
`status`). Add to **`videos`**: `mp4_key`, `hls_key`, `sprite_key`, `captions_key`,
`processing_error`, `chapters` (jsonb, 2d).

New **`jobs`** table: `id, org_id, type ('video_transcode'|'video_transcribe'),
target_id (videoId), status ('queued'|'running'|'done'|'failed'), attempts, error,
created_at, updated_at`.

`video.status`: `uploaded → processing → ready | failed`.

---

## 3. Storage (MinIO / S3)

- One bucket (e.g. `knowledgeos`). Key layout:
  ```
  videos/<orgId>/<assetId>/original.<ext>
                          /video.mp4
                          /hls/master.m3u8 + <rendition>/*.m4s   (2b)
                          /poster.jpg
                          /sprite.jpg + sprite.vtt               (2c)
                          /captions.vtt                          (2d)
  documents/<orgId>/<assetId>.<ext>
  ```
- **Next storage module reimplemented against S3** (`@aws-sdk/client-s3`) keeping the same
  interface (`putFile/readFileBuffer/readFileRange/fileSize/deleteFile`), so existing
  document/video routes keep working. Adds `getSignedGetUrl` for delivery.
- **Delivery:** Next validates auth + org, then serves via a short-lived **presigned GET**
  (offloads bandwidth from Node; supports Range/seeking). HLS segments delivered the same
  way (2b); CDN in front for real prod.
- Worker uses **boto3** against the same bucket.

---

## 4. Processing steps (worker)

1. `ffprobe` → duration/resolution/codec.
2. **MP4** — H.264/AAC, `+faststart` (fallback + download).
3. **HLS** — CMAF/fMP4 ladder (1080/720/480/360, capped at source) + master manifest. *(2b)*
4. **Poster** — frame at ~10% → downscaled `poster.jpg`.
5. **Sprite** — tiled thumbs + WebVTT for scrub. *(2c)*
6. **Transcribe** — `faster-whisper` → `captions.vtt` + transcript + chapters. *(2d)*
7. Write keys + duration + `status='ready'` (or `failed` + `processing_error`).

**Security:** ffmpeg via **argument arrays** (no shell), probe/validate inputs, per-job
**timeouts + resource limits**, write only under the asset prefix, temp-dir cleanup.

---

## 5. Python service (`apps/ai`)

```
apps/ai/
├─ Dockerfile              # python:3.12-slim + ffmpeg
├─ requirements.txt        # fastapi, uvicorn, celery, boto3, psycopg[binary], pydantic-settings
├─ pyproject/.env.example
├─ app/
│  ├─ main.py              # FastAPI: POST /jobs (Bearer), GET /health
│  ├─ config.py            # env settings
│  ├─ celery_app.py        # Celery(broker=RabbitMQ)
│  ├─ db.py                # psycopg pool to Neon
│  ├─ storage.py           # boto3 (MinIO) get/put
│  ├─ media.py             # ffprobe/ffmpeg helpers (arg-arrays)
│  └─ tasks.py             # transcode task (2a), transcribe (2d)
```

Two roles from one image: **API** (`uvicorn app.main:app`) and **worker**
(`celery -A app.celery_app worker`). Later: **Flower** for monitoring.

---

## 6. Docker Compose (local = prod parity)

Services: `rabbitmq` (mgmt UI 15672), `minio` (API 9000 / console 9001),
`minio-setup` (creates the bucket), `ai-api` (FastAPI :8000), `ai-worker` (Celery),
`flower` (:5555, later). Postgres is Neon (external); Next runs on the host and reaches
`ai-api`/MinIO via published ports.

---

## 7. Next ↔ Python contract

- **Enqueue:** on upload, Next PUTs the original to MinIO, inserts `jobs` (`queued`),
  sets `video.status='processing'`, then `POST {AI_SERVICE_URL}/jobs {jobId}` (Bearer).
  Failure to reach the API leaves the job `queued` for a reconcile sweep.
- **Process:** FastAPI enqueues the Celery task; the worker claims it, runs ffmpeg, writes
  outputs + `videos` keys + `jobs.status`. Retries with backoff; max attempts → DLQ +
  `failed`.
- **Status:** the video page reads `video.status`; a light client poll flips
  "Processing…" → player on `ready`.

---

## 8. Environment

**Next:** `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`,
`AI_SERVICE_URL`, `AI_SERVICE_TOKEN` (+ existing).
**AI:** `DATABASE_URL`, `RABBITMQ_URL`, `S3_ENDPOINT/KEY/SECRET/BUCKET/REGION`,
`AI_SERVICE_TOKEN`, `WHISPER_MODEL` (2d).

---

## 9. Reliability & observability

Idempotent tasks (re-run overwrites outputs), retries + exponential backoff, dead-letter
queue, per-job timeout, temp cleanup, structured logs with a correlation id from Next,
Flower dashboard, health checks, graceful failure → `video.status='failed'` + admin retry.

---

## 10. Phased plan

- **2a — Foundations + transcode:** compose (RabbitMQ+MinIO), `apps/ai` (FastAPI+Celery+
  ffmpeg), `jobs` table + `videos` columns, Next storage→S3 + enqueue-on-upload, MP4 +
  poster + duration, processing/ready/failed UI, presigned playback of MP4.
- **2b — Adaptive HLS:** CMAF ladder + master manifest; Vidstack HLS; `worker-src blob:` CSP.
- **2c — Scrub sprites.**
- **2d — Transcription:** faster-whisper → captions + transcript + chapters (wires the
  Video.png Transcript/Chapters panels).
- **2e — (later)** transcripts → AI search/RAG.

---

## 11. Prerequisites

Docker Desktop (or Podman/Rancher/WSL2). ffmpeg lives in the worker image (host ffmpeg no
longer required). `AI_SERVICE_TOKEN` generated. All components are free/OSS; MinIO is
self-hosted (no AWS account, no cloud fees).

## 12. Production notes

Multi-instance/CDN: put a CDN in front of MinIO (or object storage) and issue signed URLs;
Whisper wants a GPU or small model at volume; size worker concurrency to CPU. Docker
Desktop licensing only matters for large orgs — Podman/Rancher/WSL2 keep it free.
