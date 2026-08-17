from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from .config import settings
from .tasks import transcode_video

app = FastAPI(title="KnowledgeOS AI / Media Service")


class JobRequest(BaseModel):
    jobId: str
    type: str = "video_transcode"


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/jobs")
def enqueue_job(req: JobRequest, authorization: str = Header(default="")) -> dict:
    if authorization != f"Bearer {settings.ai_service_token}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if req.type == "video_transcode":
        transcode_video.delay(req.jobId)
    else:
        raise HTTPException(status_code=400, detail="Unknown job type")
    return {"enqueued": True, "jobId": req.jobId}
