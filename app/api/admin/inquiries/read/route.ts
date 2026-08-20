import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

interface RequestBody {
  messageId?: string;
  replyIds?: string[];
}

interface SheetUpdateItem {
  range: string;
  values: string[][];
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    const bodyData = (await req.json()) as RequestBody;
    const { messageId, replyIds = [] } = bodyData;
    const targetIds = new Set([messageId, ...replyIds].filter((id): id is string => Boolean(id)));

    if (targetIds.size === 0) {
      return NextResponse.json({ success: true });
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

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

    const rows = (res.data.values || []) as unknown[][];
    if (rows.length <= 1) return NextResponse.json({ success: true });

    const header = (rows[0] || []).map((h: unknown) => String(h).toLowerCase().trim());
    let idIdx = header.findIndex((h) => h === 'message_id' || h === 'id' || h === 'messageid');
    let isReadIdx = header.findIndex((h) => h === 'is_read' || h === 'isread' || h === 'read');

    if (idIdx === -1) idIdx = 0;
    if (isReadIdx === -1) isReadIdx = 5; // F列

    const updateData: SheetUpdateItem[] = [];
    rows.forEach((row, index) => {
      if (index === 0) return;
      const mId = row[idIdx]?.toString().trim();
      if (mId && targetIds.has(mId)) {
        const rowIndex = index + 1;
        const colLetter = String.fromCharCode(65 + isReadIdx); // F列
        // F列（is_read）を小文字 'true' に更新
        updateData.push({
          range: `Messages!${colLetter}${rowIndex}`,
          values: [['true']],
        });
      }
    });

    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updateData,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('既読更新エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '既読更新エラー';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}