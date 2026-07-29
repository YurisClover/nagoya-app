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

    // UsersシートとMessagesシートを全列取得
    const [usersRes, messagesRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Users!A1:Z',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Messages!A1:Z',
      }),
    ]);

    const userRows = usersRes.data.values || [];
    const messageRows = messagesRes.data.values || [];

    if (userRows.length === 0 || messageRows.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // --- 1. Usersシートから role が 'admin' の member_id を抽出 ---
    const userHeader = userRows[0];
    const memberIdIdx = userHeader.indexOf('member_id');
    const roleIdx = userHeader.indexOf('role');

    // 管理者IDのセット（文字列 'admin' 自体もデフォルトで対象に含めます）
    const adminMemberIds = new Set<string>(['admin']);

    userRows.slice(1).forEach((row) => {
      const mId = memberIdIdx !== -1 ? row[memberIdIdx] : row[0];
      const role = roleIdx !== -1 ? row[roleIdx] : '';

      if (role && role.trim().toLowerCase() === 'admin' && mId) {
        adminMemberIds.add(mId.trim());
      }
    });

    // --- 2. Messagesシートから未読件数をカウント ---
    const msgHeader = messageRows[0];
    const recipientIdIdx = msgHeader.indexOf('recipient_id');
    const isReadIdx = msgHeader.indexOf('is_read');

    let unreadCount = 0;

    messageRows.slice(1).forEach((row) => {
      const recipientId = (recipientIdIdx !== -1 ? row[recipientIdIdx] : row[2])?.trim();
      const isReadVal = (isReadIdx !== -1 ? row[isReadIdx] : row[5])?.toString().trim().toUpperCase();

      // is_read が 'FALSE' または未設定（false）
      const isUnread = isReadVal === 'FALSE' || isReadVal === '0' || !isReadVal;

      // recipient_id が role='admin' の member_id と一致 かつ 未読
      if (isUnread && recipientId && adminMemberIds.has(recipientId)) {
        unreadCount++;
      }
    });

    return NextResponse.json({ success: true, count: unreadCount });
  } catch (error: any) {
    console.error('未読バッジ件数の取得エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}