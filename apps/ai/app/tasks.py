import os
import tempfile

from celery.utils.log import get_task_logger

from . import db, media, storage
from .celery_app import celery

logger = get_task_logger(__name__)


@celery.task(
    bind=True,
    name="video.transcode",
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def transcode_video(self, job_id: str) -> None:
    """
    Phase 2a: probe duration, transcode to a compatible MP4, and grab a poster.
    HLS renditions (2b), sprites (2c), and transcription (2d) build on this.
    Idempotent — a re-run overwrites the outputs.
    """
    conn = db.connect()
    video_id = None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE jobs SET status='running', attempts=attempts+1, "
                "updated_at=now() WHERE id=%s RETURNING target_id",
                (job_id,),
            )
            row = cur.fetchone()
            if row is None:
                logger.warning("job %s not found", job_id)
                return
            video_id = row[0]
            cur.execute("SELECT file_key FROM videos WHERE id=%s", (video_id,))
            v = cur.fetchone()
            if v is None:
                return
            file_key = v[0]

        prefix = file_key.rsplit("/", 1)[0]
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "original")
            storage.download(file_key, src)

            duration = media.probe_duration(src)
            height = media.probe_height(src)

            # 1) Compatibility MP4 (fallback + download) + poster.
            mp4_path = os.path.join(tmp, "video.mp4")
            poster_path = os.path.join(tmp, "poster.jpg")
            media.transcode_mp4(src, mp4_path)
            media.poster(src, poster_path, at_seconds=min(2.0, duration * 0.1))

            mp4_key = f"{prefix}/video.mp4"
            poster_key = f"{prefix}/poster.jpg"
            storage.upload(mp4_path, mp4_key, "video/mp4")
            storage.upload(poster_path, poster_key, "image/jpeg")

            # 2) Adaptive HLS ladder.
            hls_dir = os.path.join(tmp, "hls")
            os.makedirs(hls_dir, exist_ok=True)
            media.transcode_hls(src, hls_dir, height)
            storage.upload_dir(hls_dir, f"{prefix}/hls")
            hls_key = f"{prefix}/hls/master.m3u8"

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE videos SET mp4_key=%s, hls_key=%s, poster_key=%s, "
                "duration_seconds=%s, status='ready', processing_error=NULL, "
                "updated_at=now() WHERE id=%s",
                (mp4_key, hls_key, poster_key, int(duration), video_id),
            )
            cur.execute(
                "UPDATE jobs SET status='done', error=NULL, updated_at=now() "
                "WHERE id=%s",
                (job_id,),
            )
        logger.info("transcoded video %s", video_id)

    except Exception as exc:  # noqa: BLE001 — record + retry with backoff
        logger.exception("transcode failed for job %s", job_id)
        message = str(exc)[:500]
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE jobs SET status='failed', error=%s, updated_at=now() "
                    "WHERE id=%s",
                    (message, job_id),
                )
                if video_id is not None:
                    cur.execute(
                        "UPDATE videos SET status='failed', processing_error=%s, "
                        "updated_at=now() WHERE id=%s",
                        (message, video_id),
                    )
        except Exception:  # noqa: BLE001
            logger.exception("failed to record job failure %s", job_id)
        raise self.retry(exc=exc)
    finally:
        conn.close()
