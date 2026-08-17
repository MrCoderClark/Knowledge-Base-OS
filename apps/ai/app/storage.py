import boto3
from botocore.config import Config

from .config import settings


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
