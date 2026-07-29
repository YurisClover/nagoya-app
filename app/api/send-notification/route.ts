import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    const { senderId, recipientId, title, body, url } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { success: false, error: '件名と本文は必須です' },
        { status: 400 }
      );
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: 'スプレッドシートの接続設定（環境変数）が不足しています' },
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

    // スプレッドシートの Messages シートへ書き込み追加
    // 列順: message_id, sender_id, recipient_id, title, body, created_at, read_status
    const messageId = `MSG_${Date.now()}`;
    const createdAt = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [messageId, senderId || 'admin', recipientId || 'all', title, body, createdAt, 'unread']
        ],
      },
    });

    return NextResponse.json({
      success: true,
      savedCount: 1,
      messageId,
    });
  } catch (error: any) {
    console.error('メッセージ送信エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
}