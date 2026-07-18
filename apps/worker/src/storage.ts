import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from './config.js';

export const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
});

/** Download an object's full bytes into a Buffer. */
export async function getObjectBytes(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
  if (!res.Body) throw new Error(`Object not found: ${key}`);
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}
