import os

import boto3
from botocore.config import Config

from .config import settings


def _content_type(name: str) -> str:
    if name.endswith(".m3u8"):
        return "application/vnd.apple.mpegurl"
    if name.endswith(".m4s"):
        return "video/iso.segment"
    if name.endswith(".mp4"):
        return "video/mp4"
    if name.endswith(".jpg"):
        return "image/jpeg"
    if name.endswith(".vtt"):
        return "text/vtt"
    return "application/octet-stream"


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


def download(key: str, dest_path: str) -> None:
    _client().download_file(settings.s3_bucket, key, dest_path)


def upload(src_path: str, key: str, content_type: str) -> None:
    _client().upload_file(
        src_path,
        settings.s3_bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )


def upload_dir(local_dir: str, key_prefix: str) -> None:
    """Recursively upload a directory tree, preserving relative paths."""
    client = _client()
    for root, _dirs, files in os.walk(local_dir):
        for name in files:
            local = os.path.join(root, name)
            rel = os.path.relpath(local, local_dir).replace("\\", "/")
            client.upload_file(
                local,
                settings.s3_bucket,
                f"{key_prefix}/{rel}",
                ExtraArgs={"ContentType": _content_type(name)},
            )
