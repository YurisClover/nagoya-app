import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: true, groups: [] });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Groupsシートから取得
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Groups!A1:Z',
    });

    const rows = res.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ success: true, groups: [] });
    }

    // ヘッダー行を解析（大文字小文字を無視）
    const header = rows[0].map((h) => String(h).trim().toLowerCase());
    let groupIdIdx = header.indexOf('group_id');
    let groupNameIdx = header.indexOf('group_name');

    // ヘッダー名で見つからない場合のデフォルト（A列: ID, B列: グループ名）
    if (groupIdIdx === -1) groupIdIdx = 0;
    if (groupNameIdx === -1) groupNameIdx = 1;

    const groups = rows
      .slice(1)
      .map((row) => {
        const id = row[groupIdIdx] ? String(row[groupIdIdx]).trim() : '';
        const name = row[groupNameIdx] ? String(row[groupNameIdx]).trim() : '';
        return {
          // 画面側がどの名前で参照していても動くよう両方持たせる
          group_id: id,
          group_name: name,
          id: id,
          name: name,
        };
      })
      .filter((g) => g.id !== '' || g.name !== '');

    return NextResponse.json({ success: true, groups });
  } catch (error: any) {
    console.error('グループ一覧取得エラー:', error);
    return NextResponse.json({ success: false, groups: [], error: error.message }, { status: 500 });
  }
}