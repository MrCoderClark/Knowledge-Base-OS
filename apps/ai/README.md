# apps/ai — Media / AI service

Self-hosted video processing (Phase 2). FastAPI (enqueue API) + Celery worker (ffmpeg
transcode) over RabbitMQ, reading/writing MinIO (S3) and the shared Neon Postgres.
Dependencies managed with **uv**.

## First-time setup

From `apps/ai`:

```powershell
# 1) Python env + project + deps (uv)
uv venv
uv init --bare
uv add fastapi "uvicorn[standard]" celery boto3 "psycopg[binary]" pydantic-settings

# 2) Config
copy .env.example .env    # then set DATABASE_URL (same as apps/web) and AI_SERVICE_TOKEN
```

## Run the infrastructure (from repo root)

```powershell
docker compose up -d          # RabbitMQ (:15672) + MinIO (:9001) + creates the bucket
```

## Run the service (native dev, two terminals in apps/ai)

```powershell
uv run uvicorn app.main:app --port 8001 --reload
uv run celery -A app.celery_app worker --pool=solo --loglevel=info   # --pool=solo on Windows
```

- Health check: http://localhost:8001/health
- RabbitMQ UI: http://localhost:15672 (guest/guest)
- MinIO console: http://localhost:9001 (minioadmin/minioadmin)

## Containerized (prod parity, optional)

```powershell
docker compose --profile full up --build   # also runs ai-api + ai-worker in containers
```

## Notes

- ffmpeg lives in the container image; for native dev it must be on PATH (you confirmed it is).
- Job status is the source of truth in Postgres (`jobs` + `videos`); Next reads it.
- ffmpeg is always invoked with argument arrays (no shell) and per-job timeouts.
