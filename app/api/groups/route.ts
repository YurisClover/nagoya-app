import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: { client_email: clientEmail, private_key: privateKey },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function GET() {
  try {
    if (!spreadsheetId) {
      return NextResponse.json({ success: false, error: 'スプレッドシートIDが未設定です' }, { status: 500 });
    }

    // Groupsシートの A列(group_id), B列(group_name) を取得
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Groups!A2:B',
    });

    const rows = res.data.values || [];
    const groups = rows.map((row) => ({
      group_id: row[0],   // 例: G0001
      group_name: row[1], // 例: 執行部
    })).filter((g) => g.group_id && g.group_name);

    return NextResponse.json({ success: true, groups });
  } catch (error: any) {
    console.error('グループ一覧取得エラー:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}