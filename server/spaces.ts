import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { log } from "./index";

const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || "",
    secretAccessKey: process.env.DO_SPACES_SECRET || "",
  },
  forcePathStyle: false,
});

const bucket = process.env.DO_SPACES_BUCKET || "";

export async function uploadToSpaces(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  const endpoint = process.env.DO_SPACES_ENDPOINT || "";
  const url = `https://${bucket}.${endpoint}/${key}`;
  log(`Uploaded to Spaces: ${key}`, "spaces");
  return url;
}

export async function getFromSpaces(key: string): Promise<Buffer> {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const stream = result.Body;
  if (!stream) throw new Error("No body in response");
  
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFromSpaces(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
