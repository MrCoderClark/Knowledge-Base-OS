import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@/server/env";

/**
 * Object storage (MinIO / S3-compatible). Same interface the document/video
 * routes already use, so callers are unchanged. `forcePathStyle` is required
 * for MinIO.
 */
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const Bucket = env.S3_BUCKET;

export async function putFile(
  key: string,
  data: Buffer,
  contentType?: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );
}

export async function readFileBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function fileSize(key: string): Promise<number> {
  const res = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
  return res.ContentLength ?? 0;
}

export async function readFileRange(
  key: string,
  start: number,
  end: number,
): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket, Key: key, Range: `bytes=${start}-${end}` }),
  );
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

/** Delete every object under a prefix (e.g. a video asset's whole folder). */
export async function deletePrefix(prefix: string): Promise<void> {
  let ContinuationToken: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }),
    );
    const objects = (list.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k))
      .map((Key) => ({ Key }));
    if (objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({ Bucket, Delete: { Objects: objects } }),
      );
    }
    ContinuationToken = list.IsTruncated
      ? list.NextContinuationToken
      : undefined;
  } while (ContinuationToken);
}
