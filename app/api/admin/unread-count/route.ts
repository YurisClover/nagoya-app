import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, count: 0 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const [usersRes, messagesRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A1:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Messages!A1:Z' }),
    ]);

    const userRows = usersRes.data.values || [];
    const messageRows = messagesRes.data.values || [];

    // Users
    const userHeader = (userRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let uMemberIdIdx = userHeader.findIndex((h) => h === 'member_id' || h === 'id');
    let uRoleIdx = userHeader.findIndex((h) => h === 'role');
    if (uMemberIdIdx === -1) uMemberIdIdx = 0;

    const adminMemberIds = new Set<string>(['admin']);
    userRows.slice(1).forEach((row) => {
      const mId = row[uMemberIdIdx]?.toString().trim();
      const role = uRoleIdx !== -1 ? row[uRoleIdx]?.toString().trim().toLowerCase() : '';
      if (mId && role === 'admin') {
        adminMemberIds.add(mId);
      }
    });

    // Messages
    const msgHeader = (messageRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let senderIdIdx = msgHeader.findIndex((h) => h === 'sender_id' || h === 'senderid');
    let recipientIdIdx = msgHeader.findIndex((h) => h === 'recipient_id' || h === 'recipientid');
    let titleIdx = msgHeader.findIndex((h) => h === 'title' || h === 'subject');
    let isReadIdx = msgHeader.findIndex((h) => h === 'is_read' || h === 'isread');

    if (senderIdIdx === -1) senderIdIdx = 1;
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (titleIdx === -1) titleIdx = 3;
    if (isReadIdx === -1) isReadIdx = 5;

    let unreadCount = 0;

    messageRows.slice(1).forEach((row) => {
      const senderId = row[senderIdIdx]?.toString().trim() || '';
      const recipientId = row[recipientIdIdx]?.toString().trim() || '';
      const subject = row[titleIdx]?.toString().trim() || '';
      
      // is_read の判定（'true' のみ既読扱い）
      const isReadVal = row[isReadIdx]?.toString().trim().toLowerCase();
      const isRead = isReadVal === 'true';

      // 管理者が送信したメッセージは未読カウントから除外
      const isFromAdmin = adminMemberIds.has(senderId);

      // 全体通知や全員宛の通知（(全員) など）を除外（問い合わせのみカウントする場合）
      const isSystemNotification = recipientId === 'all' || subject.startsWith('(全会員)');

      if (!isFromAdmin && !isSystemNotification && !isRead) {
        unreadCount++;
      }
    });

    return NextResponse.json({ success: true, count: unreadCount });
  } catch (error: any) {
    console.error('未読カウント取得エラー:', error);
    return NextResponse.json({ success: false, count: 0 });
  }
}