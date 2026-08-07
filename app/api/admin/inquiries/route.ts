import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

// 405エラーや静的判定を防ぐため、必ず動的レンダリングを指定します
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();
    const currentMemberId = (session?.user as any)?.member_id || session?.user?.id;

    if (!session || !currentMemberId) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    const myAdminId = String(currentMemberId).trim();

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
    }

    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const [usersRes, messagesRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A1:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Messages!A1:Z' }),
    ]);

    const userRows = usersRes.data.values || [];
    const messageRows = messagesRes.data.values || [];

    // ユーザー情報のマッピング
    const userHeader = (userRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let uMemberIdIdx = userHeader.findIndex((h) => h === 'member_id' || h === 'id' || h === 'memberid');
    let uNameIdx = userHeader.findIndex((h) => h === 'name' || h === 'username' || h === 'user_name');
    let uRoleIdx = userHeader.findIndex((h) => h === 'role');

    if (uMemberIdIdx === -1) uMemberIdIdx = 0;
    if (uNameIdx === -1) uNameIdx = 1;

    const userMap: { [key: string]: { name: string; memberId: string } } = {};
    const adminMemberIds = new Set<string>(['admin', '10001234', myAdminId.toLowerCase()]);

    userRows.slice(1).forEach((row) => {
      const mId = row[uMemberIdIdx]?.toString().trim() || '';
      const name = row[uNameIdx]?.toString().trim() || '';
      const role = uRoleIdx !== -1 ? row[uRoleIdx]?.toString().trim().toLowerCase() : '';

      if (mId) {
        userMap[mId] = { name: name || mId, memberId: mId };
        if (role === 'admin') adminMemberIds.add(mId.toLowerCase());
      }
    });

    // メッセージヘッダーの取得
    const msgHeader = (messageRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let idIdx = msgHeader.findIndex((h) => h === 'message_id' || h === 'id' || h === 'messageid');
    let senderIdIdx = msgHeader.findIndex((h) => h === 'sender_id' || h === 'senderid' || h === 'sender');
    let recipientIdIdx = msgHeader.findIndex((h) => h === 'recipient_id' || h === 'recipientid' || h === 'recipient');
    let titleIdx = msgHeader.findIndex((h) => h === 'title' || h === 'subject');
    let bodyIdx = msgHeader.findIndex((h) => h === 'body' || h === 'content');
    let isReadIdx = msgHeader.findIndex((h) => h === 'is_read' || h === 'isread' || h === 'read');
    let createdAtIdx = msgHeader.findIndex((h) => h === 'created_at' || h === 'createdat' || h === 'timestamp' || h === 'date');
    let deleteFlagIdx = msgHeader.findIndex((h) => h === 'delete_flag' || h === 'deleteflag' || h === 'is_deleted' || h === 'deleted');
    let parentIdIdx = msgHeader.findIndex((h) => h === 'parent_id' || h === 'parentid' || h === 'reply_to_id');

    if (idIdx === -1) idIdx = 0;
    if (senderIdIdx === -1) senderIdIdx = 1;
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (titleIdx === -1) titleIdx = 3;
    if (bodyIdx === -1) bodyIdx = 4;
    if (isReadIdx === -1) isReadIdx = 5;
    if (createdAtIdx === -1) createdAtIdx = 6;
    if (parentIdIdx === -1) parentIdIdx = 8;

    const parseTime = (dateStr: string) => {
      if (!dateStr) return 0;
      const t = new Date(dateStr.replace(/-/g, '/')).getTime();
      return isNaN(t) ? 0 : t;
    };

    const isAdmin = (id: string) => adminMemberIds.has((id || '').toLowerCase());

    const getGeneralUserId = (senderId: string, recipientId: string) => {
      if (isAdmin(senderId)) {
        return recipientId;
      } else {
        return senderId;
      }
    };

    const allParsedMessages: any[] = [];
    const seenMsgIds = new Set<string>();

    messageRows.slice(1).forEach((row, index) => {
      if (deleteFlagIdx !== -1) {
        const deleteFlagVal = row[deleteFlagIdx]?.toString().trim().toLowerCase();
        if (deleteFlagVal === 'true' || deleteFlagVal === '1') return;
      }

      const rawId = row[idIdx]?.toString().trim() || '';
      const senderId = row[senderIdIdx]?.toString().trim() || '';
      const recipientId = row[recipientIdIdx]?.toString().trim() || '';
      const subject = row[titleIdx]?.toString().trim() || '';
      const body = row[bodyIdx]?.toString().trim() || '';
      const createdAt = row[createdAtIdx]?.toString().trim() || '';
      const parentId = row[parentIdIdx]?.toString().trim() || '';

      if (senderId && recipientId && senderId.toLowerCase() === recipientId.toLowerCase()) return;

      const messageId = rawId || `msg-${index}`;
      if (seenMsgIds.has(messageId)) return;
      seenMsgIds.add(messageId);

      const sId = senderId.toLowerCase();
      const rId = recipientId.toLowerCase();
      const myId = myAdminId.toLowerCase();

      const isRelevant = sId === myId || rId === myId || rId === 'admin' || rId === 'all' || rId === '全体';
      if (!isRelevant) return;

      const isReadVal = row[isReadIdx]?.toString().trim().toLowerCase();
      let isRead = isReadVal === 'true' || isReadVal === '1' || isReadVal === '既読';

      if (sId === myId) {
        isRead = true;
      }

      if (messageId || body) {
        const userInfo = userMap[senderId] || { name: senderId || '不明', memberId: senderId };
        let recipientName = '不明';
        if (rId === 'all' || rId === '全体') {
          recipientName = '全会員';
        } else if (rId === 'admin') {
          recipientName = '事務局';
        } else if (userMap[recipientId]) {
          recipientName = userMap[recipientId].name;
        } else {
          recipientName = recipientId;
        }

        allParsedMessages.push({
          id: messageId,
          parentId,
          senderId,
          recipientId,
          generalUserId: getGeneralUserId(senderId, recipientId),
          userName: userInfo.name,
          memberId: userInfo.memberId,
          recipientName,
          subject,
          body,
          isRead,
          createdAt,
        });
      }
    });

    const threadMap = new Map<string, any>();
    const threadList: any[] = [];

    allParsedMessages.forEach((msg) => {
      if (!msg.parentId) {
        const newThread = {
          ...msg,
          replies: [],
        };
        threadMap.set(msg.id, newThread);
        threadList.push(newThread);
      }
    });

    allParsedMessages.forEach((msg) => {
      if (!msg.parentId) return;

      const targetParent = threadMap.get(msg.parentId);
      if (targetParent) {
        const isDuplicate = targetParent.replies.some((r: any) => r.id === msg.id);
        if (!isDuplicate) {
          targetParent.replies.push({
            id: msg.id,
            parentId: msg.parentId,
            senderId: msg.senderId,
            recipientId: msg.recipientId,
            userName: msg.userName,
            recipientName: msg.recipientName,
            memberId: msg.memberId,
            subject: msg.subject,
            body: msg.body,
            isRead: msg.isRead,
            createdAt: msg.createdAt,
          });
        }
      } else {
        threadList.push({
          ...msg,
          replies: [],
        });
      }
    });

    threadList.forEach((parent: any) => {
      parent.replies.sort((a: any, b: any) => parseTime(a.createdAt) - parseTime(b.createdAt));

      let latestTime = parseTime(parent.createdAt);
      parent.replies.forEach((r: any) => {
        const rTime = parseTime(r.createdAt);
        if (rTime > latestTime) latestTime = rTime;
      });
      parent._latestTimestamp = latestTime;
    });

    threadList.sort((a: any, b: any) => b._latestTimestamp - a._latestTimestamp);

    return NextResponse.json({ success: true, inquiries: threadList });
  } catch (error: any) {
    console.error('問い合わせ取得エラー:', error);
    return NextResponse.json({ success: false, error: error.message || '取得エラー' }, { status: 500 });
  }
}