import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
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

    // Users マップの作成と管理者IDの抽出
    const userHeader = (userRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let uMemberIdIdx = userHeader.findIndex((h) => h === 'member_id' || h === 'id');
    let uNameIdx = userHeader.findIndex((h) => h === 'name' || h === 'username');
    let uRoleIdx = userHeader.findIndex((h) => h === 'role');

    if (uMemberIdIdx === -1) uMemberIdIdx = 0;
    if (uNameIdx === -1) uNameIdx = 1;

    const userMap: { [key: string]: { name: string; memberId: string } } = {};
    const adminMemberIds = new Set<string>(['admin', '10001234']); // 必要に応じて管理者の固定IDを追加

    userRows.slice(1).forEach((row) => {
      const mId = row[uMemberIdIdx]?.toString().trim() || '';
      const name = row[uNameIdx]?.toString().trim() || '';
      const role = uRoleIdx !== -1 ? row[uRoleIdx]?.toString().trim().toLowerCase() : '';

      if (mId) {
        userMap[mId] = { name: name || mId, memberId: mId };
        if (role === 'admin') adminMemberIds.add(mId);
      }
    });

    // Messages パース
    const msgHeader = (messageRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let idIdx = msgHeader.findIndex((h) => h === 'message_id' || h === 'id');
    let senderIdIdx = msgHeader.findIndex((h) => h === 'sender_id' || h === 'senderid');
    let recipientIdIdx = msgHeader.findIndex((h) => h === 'recipient_id' || h === 'recipientid');
    let titleIdx = msgHeader.findIndex((h) => h === 'title' || h === 'subject');
    let bodyIdx = msgHeader.findIndex((h) => h === 'body' || h === 'content');
    let isReadIdx = msgHeader.findIndex((h) => h === 'is_read' || h === 'isread');
    let createdAtIdx = msgHeader.findIndex((h) => h === 'created_at' || h === 'createdat' || h === 'timestamp');

    if (idIdx === -1) idIdx = 0;
    if (senderIdIdx === -1) senderIdIdx = 1;
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (titleIdx === -1) titleIdx = 3;
    if (bodyIdx === -1) bodyIdx = 4;
    if (isReadIdx === -1) isReadIdx = 5;
    if (createdAtIdx === -1) createdAtIdx = 6;

    const allParsedMessages: any[] = [];

    messageRows.slice(1).forEach((row) => {
      const id = row[idIdx]?.toString().trim() || '';
      const senderId = row[senderIdIdx]?.toString().trim() || '';
      const recipientId = row[recipientIdIdx]?.toString().trim() || '';
      const subject = row[titleIdx]?.toString().trim() || '';
      const body = row[bodyIdx]?.toString().trim() || '';
      
      // is_read の判定（'true' のみ既読扱い）
      const isReadVal = row[isReadIdx]?.toString().trim().toLowerCase();
      const isRead = isReadVal === 'true';

      const createdAt = row[createdAtIdx]?.toString().trim() || '';

      if (id || body) {
        const userInfo = userMap[senderId] || { name: senderId || '不明', memberId: senderId };

        allParsedMessages.push({
          id,
          senderId,
          recipientId,
          userName: userInfo.name,
          memberId: userInfo.memberId,
          subject,
          body,
          isRead,
          createdAt,
        });
      }
    });

    // ツリー構造化
    const parentMap: { [key: string]: any } = {};

    // 1. 親メッセージの登録（管理者宛てのメッセージのみを対象とする）
    allParsedMessages.forEach((msg) => {
      if (!msg.subject.startsWith('Re:')) {
        const isToAdmin = adminMemberIds.has(msg.recipientId);

        if (isToAdmin) {
          const key = msg.subject.trim();
          if (!parentMap[key] || new Date(msg.createdAt) > new Date(parentMap[key].createdAt)) {
            parentMap[key] = {
              ...msg,
              replies: [],
            };
          }
        }
      }
    });

    // 2. 返信（Re:）メッセージの紐づけ
    allParsedMessages.forEach((msg) => {
      if (msg.subject.startsWith('Re:')) {
        const cleanSubject = msg.subject.replace(/^Re:\s*/i, '').trim();
        const parent = parentMap[cleanSubject];

        if (parent) {
          parent.replies.push({
            id: msg.id,
            senderId: msg.senderId,
            recipientId: msg.recipientId,
            userName: msg.userName,
            memberId: msg.memberId,
            subject: msg.subject,
            body: msg.body,
            isRead: msg.isRead,
            createdAt: msg.createdAt,
          });
        }
      }
    });

    // ソート（作成日時が新しいものを上）
    const inquiries = Object.values(parentMap).sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, inquiries });
  } catch (error: any) {
    console.error('問い合わせ取得エラー:', error);
    return NextResponse.json({ success: false, error: error.message || '取得エラー' }, { status: 500 });
  }
}