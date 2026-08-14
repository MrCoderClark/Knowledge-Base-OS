import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";

/**
 * File storage — currently the local filesystem. This module is the single
 * boundary; replace it with an S3/object-storage implementation later without
 * changing callers. Keys are relative paths like `documents/<orgId>/<uuid>.pdf`.
 */
const BASE = path.resolve(process.cwd(), env.STORAGE_DIR);

function resolveKey(key: string): string {
  const full = path.resolve(BASE, key);
  // Guard against path traversal escaping the storage root.
  if (full !== BASE && !full.startsWith(BASE + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export async function putFile(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export function readFileBuffer(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await unlink(resolveKey(key));
  } catch {
    // Already gone — nothing to do.
  }
}
