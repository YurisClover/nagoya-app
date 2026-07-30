import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
  try {
    const { messageId } = await req.json();

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageId が指定されていません' },
        { status: 400 }
      );
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: '環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Messagesシート全行を取得して対象 message_id の行番号を特定
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A1:Z',
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({ success: false, error: 'データが存在しません' }, { status: 404 });
    }

    const header = rows[0].map((h: any) => String(h).toLowerCase().trim());
    let mIdIdx = header.findIndex((h: string) => h === 'message_id' || h === 'id');
    let isReadIdx = header.findIndex((h: string) => h === 'is_read' || h === 'isread');

    if (mIdIdx === -1) mIdIdx = 0;
    if (isReadIdx === -1) isReadIdx = 5;

    // 対象メッセージの行インデックスを検索 (1-based index)
    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][mIdIdx]?.toString().trim() === messageId) {
        targetRowIndex = i + 1; // スプレッドシートの行番号は1始まり
        break;
      }
    }

    if (targetRowIndex === -1) {
      return NextResponse.json({ success: false, error: '対象のメッセージが見つかりませんでした' }, { status: 404 });
    }

    // 列記号を算出（例: 0 -> A, 5 -> F）
    const columnLetter = String.fromCharCode(65 + isReadIdx);
    const updateRange = `Messages!${columnLetter}${targetRowIndex}`;

    // 2. is_read セルを 'true' に更新
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['true']],
      },
    });

    return NextResponse.json({ success: true, messageId });
  } catch (error: any) {
    console.error('既読更新エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '既読更新に失敗しました' },
      { status: 500 }
    );
  }
}