// 返信送信 API

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import crypto from 'crypto';

interface SessionUser {
  id?: string;
  member_id?: string;
}

interface RequestBody {
  parentMessageId?: string;
  recipientId?: string;
  subject?: string;
  body?: string;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    const currentMemberId = user?.member_id || user?.id;

    if (!session || !currentMemberId) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    const bodyData = (await req.json()) as RequestBody;
    const { parentMessageId, recipientId, subject, body } = bodyData;

    if (!parentMessageId || !recipientId || !body) {
      return NextResponse.json({ success: false, error: '必須パラメーターが不足しています' }, { status: 400 });
    }

    const myAdminId = String(currentMemberId).trim();
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
    }

    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const newMessageId = crypto.randomUUID();
    const now = new Date();
    const createdAt = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const cleanSubject = (subject || '').replace(/^Re:\s*/i, '').trim();
    const replyTitle = `Re: ${cleanSubject}`;

    // 行データ（A: message_id, B: sender_id, C: recipient_id, D: subject, E: body, F: is_read, G: created_at, H: delete_flag, I: parent_id）
    const newRow = [
      newMessageId,
      myAdminId,
      recipientId,
      replyTitle,
      body,
      'false',
      createdAt,
      'false',
      parentMessageId, // ★ I列に親メッセージの message_id を格納
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A1:I',
      valueInputOption: 'RAW',
      requestBody: {
        values: [newRow],
      },
    });

    return NextResponse.json({ success: true, messageId: newMessageId });
  } catch (error: unknown) {
    console.error('返信送信エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '送信エラー';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}