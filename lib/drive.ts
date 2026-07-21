import "server-only";
import { google } from "googleapis";
import { Readable } from "stream";
import { getServiceAccountCredentials } from "./google-auth";

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive.readonly"];

export type NewsletterPdf = { id: string; name: string; createdTime: string };

function getDrive() {
  const { client_email, private_key } = getServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: DRIVE_SCOPE,
  });
  return google.drive({ version: "v3", auth });
}

export async function listNewsletterPdfs(): Promise<NewsletterPdf[]> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");
  const res = await getDrive().files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/pdf'`,
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
  });
  return (res.data.files ?? []) as NewsletterPdf[];
}

export async function getPdfStream(fileId: string): Promise<ReadableStream> {
  const res = await getDrive().files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  return Readable.toWeb(res.data as Readable) as unknown as ReadableStream;
}