import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    // 1. 環境変数の取得（各種表記揺れに対応）
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.error('【unread-count API】環境変数が不足しています:', {
        hasClientEmail: Boolean(clientEmail),
        hasPrivateKey: Boolean(privateKey),
        hasSpreadsheetId: Boolean(spreadsheetId),
      });
      return NextResponse.json(
        { success: false, error: 'スプレッドシートの設定（環境変数）が不足しています' },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 2. UsersシートとMessagesシートを取得
    const [usersRes, messagesRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A1:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Messages!A1:Z' }),
    ]);

    const userRows = usersRes.data.values || [];
    const messageRows = messagesRes.data.values || [];

    if (userRows.length === 0 || messageRows.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 3. 管理者 (role='admin') の member_id 一覧を抽出
    const userHeader = (userRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let memberIdIdx = userHeader.findIndex((h: string) => h === 'member_id' || h === 'id');
    let roleIdx = userHeader.findIndex((h: string) => h === 'role');

    if (memberIdIdx === -1) memberIdIdx = 0;
    if (roleIdx === -1) roleIdx = 1;

    const adminMemberIds = new Set<string>(['admin']);

    userRows.slice(1).forEach((row: any[]) => {
      const mId = row[memberIdIdx]?.toString().trim();
      const role = row[roleIdx]?.toString().trim().toLowerCase();

      if (role === 'admin' && mId) {
        adminMemberIds.add(mId);
      }
    });

    // 4. 管理者宛ての未読数をカウント
    const msgHeader = (messageRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let recipientIdIdx = msgHeader.findIndex((h: string) => h === 'recipient_id' || h === 'recipientid');
    let isReadIdx = msgHeader.findIndex((h: string) => h === 'is_read' || h === 'isread');

    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (isReadIdx === -1) isReadIdx = 5;

    let unreadCount = 0;

    messageRows.slice(1).forEach((row: any[]) => {
      const recipientId = row[recipientIdIdx]?.toString().trim();
      const isReadVal = row[isReadIdx]?.toString().trim().toUpperCase();

      const isUnread =
        !isReadVal ||
        isReadVal === 'UNREAD' ||
        isReadVal === '未読' ||
        isReadVal === 'FALSE' ||
        isReadVal === '0';

      if (isUnread && recipientId && adminMemberIds.has(recipientId)) {
        unreadCount++;
      }
    });

    return NextResponse.json({ success: true, count: unreadCount });
  } catch (error: any) {
    console.error('【unread-count API 実行エラー】:', error);
    return NextResponse.json(
      { success: false, error: error.message || '内部エラーが発生しました' },
      { status: 500 }
    );
  }
}