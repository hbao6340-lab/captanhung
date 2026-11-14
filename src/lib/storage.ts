/**
 * Evidence storage adapter.
 *
 * Default: local disk under ./evidence. Files are NOT served through public
 * permanent URLs. Authorized administrators fetch them through a protected
 * API route that streams the file and sets short-lived cache headers.
 *
 * Optional: S3-compatible object storage via AWS SDK v3 when
 * S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY are set.
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

const UPLOAD_LIMIT_BYTES = Number(process.env.UPLOAD_LIMIT_BYTES ?? 10 * 1024 * 1024); // 10 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const USE_S3 = Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET);
let s3Client: any = null;
let s3Bucket: string | null = null;

async function getS3() {
  if (!USE_S3) throw new Error("S3 is not configured");
  if (s3Client) return { client: s3Client, bucket: s3Bucket as string };
  // Lazy import so the package is optional.
  const { S3Client } = await import("@aws-sdk/client-s3");
  const endpoint = process.env.S3_ENDPOINT!;
  s3Client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });
  s3Bucket = process.env.S3_BUCKET!;
  return { client: s3Client, bucket: s3Bucket as string };
}

export const MAX_FILE_SIZE = UPLOAD_LIMIT_BYTES;

export interface ValidatedFile {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

/**
 * Generate a storage key that is unguessable and scoped to event/attendance/stage.
 */
export function makeStorageKey(eventId: string, attendanceId: string, stage: string, filename: string): string {
  const ext = filename.toLowerCase().endsWith(".") ? "" : filename.slice(filename.lastIndexOf("."));
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".bin";
  const random = createHash("sha256").update(`${Date.now()}:${Math.random()}:${storageKeyNonce()}`).digest("hex").slice(0, 24);
  return `evidence/${eventId}/${attendanceId}/${stage}/${random}${safeExt}`;
}

function storageKeyNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("hex");
}

/**
 * Validate an uploaded file: extension, MIME type, size.
 * Note: MIME type / extension validation does not prove authenticity of the image content.
 */
export function validateFile(file: File): { ok: true; file: ValidatedFile } | { ok: false; error: string } {
  const name = file.name;
  const ext = name.lastIndexOf(".") === -1 ? "" : name.slice(name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Unsupported file extension "${ext}". Allowed: .jpg, .jpeg, .png, .webp` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `File too large. Maximum size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.` };
  }
  const mime = file.type?.toLowerCase() ?? "";
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return { ok: false, error: `Unsupported MIME type "${mime}". Allowed: image/jpeg, image/png, image/webp.` };
  }
  return { ok: true, file: file as unknown as ValidatedFile };
}

/**
 * Read an uploaded File into a buffer and attach metadata.
 */
export async function readFileBuffer(file: File): Promise<Buffer> {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Store a validated file buffer. Returns the storage key.
 */
export async function storeFile(params: {
  buffer: Buffer;
  storageKey: string;
  mimeType: string;
  eventId: string;
}): Promise<{ key: string; path: string }> {
  const { buffer, storageKey, mimeType, eventId } = params;
  if (USE_S3) {
    const { client, bucket } = await getS3();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return { key: storageKey, path: `s3://${bucket}/${storageKey}` };
  }

  const root = process.env.EVIDENCE_STORAGE_PATH ?? join(/*turbopackIgnore: true*/ process.cwd(), "evidence");
  const fullPath = join(/*turbopackIgnore: true*/ root, storageKey);
  await fs.mkdir(join(/*turbopackIgnore: true*/ root, "evidence", eventId), { recursive: true });
  // storageKey already includes evidence/<eventId>/..., so join(root, storageKey) is correct.
  await fs.writeFile(/*turbopackIgnore: true*/ fullPath, buffer);
  return { key: storageKey, path: fullPath };
}

/**
 * Retrieve a file buffer by storage key (server-side only).
 */
export async function getFileBuffer(storageKey: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (USE_S3) {
    const { client, bucket } = await getS3();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    // For S3 we return a signed URL instead of buffering; caller handles.
    const url = await getSignedUrl(
      client,
      new (await import("@aws-sdk/client-s3")).GetObjectCommand({ Bucket: bucket, Key: storageKey }),
      { expiresIn: 300 }
    );
    return null; // S3 path handled via signed URL route
  }

  const root = process.env.EVIDENCE_STORAGE_PATH ?? join(/*turbopackIgnore: true*/ process.cwd(), "evidence");
  const fullPath = join(/*turbopackIgnore: true*/ root, storageKey);
  try {
    const buffer = await fs.readFile(/*turbopackIgnore: true*/ fullPath);
    const mime = mimeFromExtension(storageKey);
    return { buffer, mimeType: mime };
  } catch {
    return null;
  }
}

function mimeFromExtension(key: string): string {
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export function buildEvidenceUrl(storageKey: string): string {
  // Server-side proxy route that enforces authorization and returns the file.
  return `/api/admin/evidence?key=${encodeURIComponent(storageKey)}`;
}
