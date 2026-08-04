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

    // ヘッダーの揺れ（is_read, isRead, isread 等）を確実に検知できるように正規化
    const header = rows[0].map((h: any) => String(h).toLowerCase().replace(/[_-\s]/g, '').trim());
    let idIdx = header.findIndex((h) => h === 'messageid' || h === 'id' || h === 'message_id');
    let isReadIdx = header.findIndex((h) => h === 'isread' || h === 'is_read' || h === 'read');

    if (idIdx === -1) idIdx = 0;
    if (isReadIdx === -1) isReadIdx = 5; // 見つからない場合のデフォルト（F列）

    // 既読対象とするメッセージIDのセット（親ID + 配下の返信ID群）
    const idsToMarkRead = new Set<string>([messageId, ...(replyIds || [])]);

    const updatePromises: Promise<any>[] = [];

    rows.slice(1).forEach((row, index) => {
      const currentId = row[idIdx]?.toString().trim();
      if (currentId && idsToMarkRead.has(currentId)) {
        const rowIndex = index + 2; // ヘッダーを考慮した1-basedの行番号

        // 行データをコピーして、is_read の列だけを強制的に 'true' に書き換える
        const updatedRow = [...row];
        while (updatedRow.length <= isReadIdx) {
          updatedRow.push('');
        }
        updatedRow[isReadIdx] = 'true';

        // 該当行の範囲（A列からデータが存在する最後の列まで）を指定して丸ごと更新
        const lastColIdx = Math.max(updatedRow.length - 1, isReadIdx);
        const lastColChar = String.fromCharCode(65 + lastColIdx);
        const range = `Messages!A${rowIndex}:${lastColChar}${rowIndex}`;

        updatePromises.push(
          sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            requestBody: {
              values: [updatedRow],
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