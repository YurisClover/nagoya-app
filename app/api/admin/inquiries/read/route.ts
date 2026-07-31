import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
  try {
    const { messageId, replyIds } = await req.json();

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageIdが指定されていません' },
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
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Messagesシートを取得
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A1:Z',
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({ success: true, updatedCount: 0 });
    }

    const header = rows[0].map((h: any) => String(h).toLowerCase().trim());
    let idIdx = header.findIndex((h) => h === 'message_id' || h === 'id');
    let isReadIdx = header.findIndex((h) => h === 'is_read' || h === 'isread');

    if (idIdx === -1) idIdx = 0;
    if (isReadIdx === -1) isReadIdx = 5; // F列

    // 既読対象とするメッセージIDのセット（親ID + 配下の返信ID群）
    const idsToMarkRead = new Set<string>([messageId, ...(replyIds || [])]);

    const updatePromises: Promise<any>[] = [];

    rows.slice(1).forEach((row, index) => {
      const currentId = row[idIdx]?.toString().trim();
      if (currentId && idsToMarkRead.has(currentId)) {
        const rowIndex = index + 2; // ヘッダー行考慮の1-based行番号
        const range = `Messages!${String.fromCharCode(65 + isReadIdx)}${rowIndex}`;

        updatePromises.push(
          sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW', // ★ RAW に変更
            requestBody: {
              values: [['true']], // 小文字の 'true'
            },
          })
        );
      }
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, updatedCount: updatePromises.length });
  } catch (error: any) {
    console.error('既読処理エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '更新エラー' },
      { status: 500 }
    );
  }
}