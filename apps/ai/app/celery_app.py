from celery import Celery

from .config import settings

celery = Celery(
    "knowledgeos",
    broker=settings.rabbitmq_url,
    include=["app.tasks"],
)

celery.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    task_ignore_result=True,  # status lives in the Postgres `jobs` table
)
