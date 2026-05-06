/**
 * storage.ts — Cloudflare R2 client
 *
 * Handles document storage for Pinto Law:
 * - DOCX templates (workflows)
 * - Generated documents (filled templates)
 * - Uploaded case files (future)
 *
 * R2 is S3-compatible — uses @aws-sdk/client-s3.
 *
 * Env vars:
 *   R2_ENDPOINT_URL     — Cloudflare R2 endpoint
 *   R2_ACCESS_KEY_ID    — R2 access key
 *   R2_SECRET_ACCESS_KEY — R2 secret key
 *   R2_BUCKET_NAME      — bucket name (pinto-law-docs)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    const endpoint = process.env.R2_ENDPOINT_URL;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2 storage not configured — set R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
      );
    }

    _client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return _client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not set");
  return bucket;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ key: string; size: number }> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, size: body.length };
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function downloadFile(key: string): Promise<Buffer> {
  const client = getClient();
  const bucket = getBucket();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Empty response for key: ${key}`);
  }

  // Convert readable stream to Buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Check if file exists
// ---------------------------------------------------------------------------

export async function fileExists(key: string): Promise<boolean> {
  const client = getClient();
  const bucket = getBucket();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteFile(key: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

// ---------------------------------------------------------------------------
// List files by prefix
// ---------------------------------------------------------------------------

export async function listFiles(
  prefix: string,
): Promise<{ key: string; size: number; lastModified: Date | undefined }[]> {
  const client = getClient();
  const bucket = getBucket();

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    }),
  );

  return (
    response.Contents?.map((item) => ({
      key: item.Key ?? "",
      size: item.Size ?? 0,
      lastModified: item.LastModified,
    })) ?? []
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a storage key for a workflow template.
 * Pattern: templates/{workflowId}/{filename}
 */
export function templateKey(workflowId: string, filename: string): string {
  return `templates/${workflowId}/${filename}`;
}

/**
 * Generate a storage key for a generated (filled) document.
 * Pattern: generated/{projectId}/{timestamp}-{filename}
 */
export function generatedDocKey(
  projectId: string,
  filename: string,
): string {
  const ts = Date.now();
  return `generated/${projectId}/${ts}-${filename}`;
}
