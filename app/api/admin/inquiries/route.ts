import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: 'スプレッドシートの環境変数が設定されていません' },
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

    // UsersシートとMessagesシートを取得
    const [usersRes, messagesRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A1:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Messages!A1:Z' }),
    ]);

    const userRows = usersRes.data.values || [];
    const messageRows = messagesRes.data.values || [];

    // --- 1. 管理者の member_id を収集 ---
    const userHeader = (userRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let uMemberIdIdx = userHeader.findIndex((h: string) => h === 'member_id' || h === 'id');
    let uNameIdx = userHeader.findIndex((h: string) => h === 'user_name' || h === 'username' || h === 'name');
    let uRoleIdx = userHeader.findIndex((h: string) => h === 'role');

    if (uMemberIdIdx === -1) uMemberIdIdx = 0;
    if (uNameIdx === -1) uNameIdx = 1;

    const adminMemberIds = new Set<string>(['admin']); // デフォルトで 'admin' を含める
    const userMap = new Map<string, string>(); // member_id -> user_name のマップ

    userRows.slice(1).forEach((row: any[]) => {
      const mId = row[uMemberIdIdx]?.toString().trim();
      const uName = row[uNameIdx]?.toString().trim();
      const role = uRoleIdx !== -1 ? row[uRoleIdx]?.toString().trim().toLowerCase() : '';

      if (mId) {
        if (uName) userMap.set(mId, uName);
        if (role === 'admin') adminMemberIds.add(mId);
      }
    });

    // --- 2. Messagesシートから管理者宛てのメッセージのみ抽出 ---
    const msgHeader = (messageRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let mIdIdx = msgHeader.findIndex((h: string) => h === 'message_id' || h === 'id');
    let senderIdIdx = msgHeader.findIndex((h: string) => h === 'sender_id' || h === 'senderid');
    let recipientIdIdx = msgHeader.findIndex((h: string) => h === 'recipient_id' || h === 'recipientid');
    let titleIdx = msgHeader.findIndex((h: string) => h === 'title' || h === 'subject');
    let bodyIdx = msgHeader.findIndex((h: string) => h === 'body' || h === 'content');
    let isReadIdx = msgHeader.findIndex((h: string) => h === 'is_read' || h === 'isread');
    let createdAtIdx = msgHeader.findIndex((h: string) => h === 'created_at' || h === 'createdat');

    if (mIdIdx === -1) mIdIdx = 0;
    if (senderIdIdx === -1) senderIdIdx = 1;
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (titleIdx === -1) titleIdx = 3;
    if (bodyIdx === -1) bodyIdx = 4;
    if (isReadIdx === -1) isReadIdx = 5;
    if (createdAtIdx === -1) createdAtIdx = 6;

    const inquiries = messageRows
      .slice(1)
      .filter((row: any[]) => {
        const recipientId = row[recipientIdIdx]?.toString().trim();
        // recipient_id が admin または 管理者ユーザーの member_id と一致するもののみ
        return recipientId && adminMemberIds.has(recipientId);
      })
      .map((row: any[]) => {
        const senderId = row[senderIdIdx]?.toString().trim() || '不明';
        const isReadVal = row[isReadIdx]?.toString().trim().toLowerCase();

        // 'read', 'true', '1', '既読' の場合のみ true (既読) と判定
        const isRead =
          isReadVal === 'read' ||
          isReadVal === 'true' ||
          isReadVal === '1' ||
          isReadVal === '既読';

        return {
          id: row[mIdIdx]?.toString() || crypto.randomUUID(),
          senderId: senderId,
          userName: userMap.get(senderId) || senderId,
          subject: row[titleIdx]?.toString() || '（無題）',
          body: row[bodyIdx]?.toString() || '',
          isRead: isRead, // boolean型で返す
          createdAt: row[createdAtIdx]?.toString() || '',
        };
      })
      .reverse(); // 新しい順に並び替え

    return NextResponse.json({ success: true, inquiries });
  } catch (error: any) {
    console.error('問い合わせメッセージ取得エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '取得処理エラー' },
      { status: 500 }
    );
  }
}