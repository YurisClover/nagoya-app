import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // UsersシートとMessagesシートを並行取得
    const [usersRes, messagesRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Users!A2:C', // A: member_id, B: user_name, ... と想定
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Messages!A2:G', // message_id, sender_id, recipient_id, subject, body, is_read, created_at
      }),
    ]);

    // Usersシートから { sender_id: user_name } のマッピング辞書を作成
    const userRows = usersRes.data.values || [];
    const userMap: Record<string, string> = {};
    userRows.forEach((row) => {
      const memberId = row[0]; // member_id
      const userName = row[1]; // user_name
      if (memberId) {
        userMap[memberId] = userName || '名称未設定';
      }
    });

    // Messagesシートをパース（管理者宛・または会員からの送信メッセージを対象）
    const messageRows = messagesRes.data.values || [];
    const inquiries = messageRows
      .map((row, index) => {
        const [message_id, sender_id, recipient_id, subject, body, is_read, created_at] = row;
        return {
          id: message_id || `msg_${index}`,
          senderId: sender_id || '',
          userName: userMap[sender_id] || '不明なユーザー',
          subject: subject || '(件名なし)',
          body: body || '',
          createdAt: created_at || '',
        };
      })
      // 管理者自身の送信を除外する場合はコメントアウトを解除
      // .filter((item) => item.senderId !== 'admin')
      .reverse(); // 最新順に並び替え

    return NextResponse.json({ success: true, inquiries });
  } catch (error: any) {
    console.error('受信メッセージの取得に失敗しました:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}