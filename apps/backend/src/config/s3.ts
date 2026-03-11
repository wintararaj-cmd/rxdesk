import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  // When S3_ENDPOINT is set the client targets Cloudflare R2 or Backblaze B2
  // instead of AWS S3 — no other code changes required.
  ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
});

export default s3;

/**
 * Upload a buffer to S3 and return the file key
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  if (!env.S3_BUCKET_NAME) throw new Error('S3_BUCKET_NAME not configured');

  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Generate a pre-signed URL for private file access (15 minute expiry by default)
 */
export async function getPresignedUrl(key: string, expiresIn = 900): Promise<string> {
  if (!env.S3_BUCKET_NAME) throw new Error('S3_BUCKET_NAME not configured');

  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!env.S3_BUCKET_NAME) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
    })
  );
}
