import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

type MessageStatus = 'unsupported' | 'pending' | 'closed';

interface RequestBody {
  messageId: string;
  status: MessageStatus;
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    const body = (await req.json()) as RequestBody;
    const { messageId, status } = body;

    if (!messageId || !['unsupported', 'pending', 'closed'].includes(status)) {
      return NextResponse.json({ success: false, error: '無効なパラメータです' }, { status: 400 });
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
    }

    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A1:Z',
    });

    const rows = (res.data.values as string[][]) || [];
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'メッセージが見つかりません' }, { status: 404 });
    }

    const header = (rows[0] || []).map((h: string) => h.toLowerCase().trim());
    let idIdx = header.findIndex((h: string) => h === 'message_id' || h === 'id' || h === 'messageid');
    let statusIdx = header.findIndex((h: string) => h === 'status');

    if (idIdx === -1) idIdx = 0;
    if (statusIdx === -1) statusIdx = 9; // J列 (0-indexedで9)

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const rowId = rows[i]?.[idIdx]?.toString().trim() ?? '';
      if (rowId === messageId) {
        rowIndex = i + 1; // 1-indexed for sheets
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: '対象のメッセージが見つかりません' }, { status: 404 });
    }

    const columnLetter = String.fromCharCode(65 + statusIdx);
    const range = `Messages!${columnLetter}${rowIndex}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}