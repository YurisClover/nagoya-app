// src/app/api/messages/delete/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    const { messageId } = await request.json();
    if (!messageId) {
      return NextResponse.json({ success: false, error: 'messageId が指定されていません' }, { status: 400 });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
    }

    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 1. Messagesシートの全データを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A:H',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Messagesシートにデータがありません' }, { status: 404 });
    }

    const headers = rows[0].map((h: string) => h.toLowerCase().trim());
    let idIdx = headers.findIndex((h) => h === 'message_id' || h === 'id');
    let deleteFlagIdx = headers.findIndex((h) => h === 'delete_flag');

    if (idIdx === -1) idIdx = 0; // A列
    if (deleteFlagIdx === -1) deleteFlagIdx = 7; // H列 (index 7)

    // 2. 対象メッセージの行番号を検索 (ヘッダー行があるので index + 1)
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx]?.toString().trim() === messageId) {
        rowIndex = i + 1; // スプレッドシートは1始まり
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: '該当メッセージが見つかりませんでした' }, { status: 404 });
    }

    // 3. delete_flag の列記号を取得 (例: H列)
    const colLetter = String.fromCharCode(65 + deleteFlagIdx);

    // 4. delete_flag をブール値の true に更新 (論理削除)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Messages!${colLetter}${rowIndex}`,
      valueInputOption: 'USER_ENTERED', // ★ 文字列ではなく適切な値として解釈させる
      requestBody: {
        values: [[true]], // ★ JavaScriptの boolean 値 true を渡す
      },
    });

    return NextResponse.json({ success: true, message: 'メッセージを削除しました' });
  } catch (error: any) {
    console.error('Delete Message Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}