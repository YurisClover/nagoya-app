import { NextRequest } from 'next/server';
import { google } from 'googleapis';

// カッコの中の { params } で、フォルダ名になっている [fileId] を自動的に受け取れます
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  // await params を使って、フォルダ名の fileId を取得
  const { fileId } = await params;

  if (!fileId) {
    return new Response('ファイルIDが指定されていません', { status: 400 });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.CLIENT_EMAIL,
      private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  try {
    const pdfResponse = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const stream = pdfResponse.data as unknown as ReadableStream;
    return new Response(stream, {
      headers: { 'Content-Type': 'application/pdf' },
    });
  } catch (error) {
    console.error(error);
    return new Response('PDFの取得に失敗しました', { status: 500 });
  }
}