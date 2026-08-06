import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    const currentMemberId = (session?.user as any)?.member_id || session?.user?.id;

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

    const userHeader = (userRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let uMemberIdIdx = userHeader.findIndex((h) => h === 'member_id' || h === 'id');
    let uNameIdx = userHeader.findIndex((h) => h === 'name' || h === 'username');
    let uRoleIdx = userHeader.findIndex((h) => h === 'role');

    if (uMemberIdIdx === -1) uMemberIdIdx = 0;
    if (uNameIdx === -1) uNameIdx = 1;

    const userMap: { [key: string]: { name: string; memberId: string } } = {};
    const adminMemberIds = new Set<string>(['admin', '10001234']);

    userRows.slice(1).forEach((row) => {
      const mId = row[uMemberIdIdx]?.toString().trim() || '';
      const name = row[uNameIdx]?.toString().trim() || '';
      const role = uRoleIdx !== -1 ? row[uRoleIdx]?.toString().trim().toLowerCase() : '';

      if (mId) {
        userMap[mId] = { name: name || mId, memberId: mId };
        if (role === 'admin') adminMemberIds.add(mId);
      }
    });

    const msgHeader = (messageRows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    let idIdx = msgHeader.findIndex((h) => h === 'message_id' || h === 'id');
    let senderIdIdx = msgHeader.findIndex((h) => h === 'sender_id' || h === 'senderid');
    let recipientIdIdx = msgHeader.findIndex((h) => h === 'recipient_id' || h === 'recipientid');
    let titleIdx = msgHeader.findIndex((h) => h === 'title' || h === 'subject');
    let bodyIdx = msgHeader.findIndex((h) => h === 'body' || h === 'content');
    let isReadIdx = msgHeader.findIndex((h) => h === 'is_read' || h === 'isread');
    let createdAtIdx = msgHeader.findIndex((h) => h === 'created_at' || h === 'createdat' || h === 'timestamp');
    let deleteFlagIdx = msgHeader.findIndex((h) => h === 'delete_flag' || h === 'deleteflag' || h === 'is_deleted');

    if (idIdx === -1) idIdx = 0;
    if (senderIdIdx === -1) senderIdIdx = 1;
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (titleIdx === -1) titleIdx = 3;
    if (bodyIdx === -1) bodyIdx = 4;
    if (isReadIdx === -1) isReadIdx = 5;
    if (createdAtIdx === -1) createdAtIdx = 6;

    const allParsedMessages: any[] = [];

    messageRows.slice(1).forEach((row) => {
      if (deleteFlagIdx !== -1) {
        const deleteFlagVal = row[deleteFlagIdx]?.toString().trim().toLowerCase();
        if (deleteFlagVal === 'true' || deleteFlagVal === '1') {
          return;
        }
      }

      const id = row[idIdx]?.toString().trim() || '';
      const senderId = row[senderIdIdx]?.toString().trim() || '';
      const recipientId = row[recipientIdIdx]?.toString().trim() || '';

      // 自分自身宛（sender_id === recipient_id）のメッセージを除外
      if (senderId && recipientId && senderId === recipientId) {
        return;
      }

      const subject = row[titleIdx]?.toString().trim() || '';
      const body = row[bodyIdx]?.toString().trim() || '';
      
      const isReadVal = row[isReadIdx]?.toString().trim().toLowerCase();
      let isRead = isReadVal === 'true';

      if (currentMemberId && senderId === String(currentMemberId).trim()) {
        isRead = true;
      }

      const createdAt = row[createdAtIdx]?.toString().trim() || '';

      if (id || body) {
        const userInfo = userMap[senderId] || { name: senderId || '不明', memberId: senderId };
        const recipientInfo = userMap[recipientId] || { name: recipientId || '不明', memberId: recipientId };

        allParsedMessages.push({
          id,
          senderId,
          recipientId,
          userName: userInfo.name,
          memberId: userInfo.memberId,
          recipientName: recipientInfo.name,
          subject,
          body,
          isRead,
          createdAt,
        });
      }
    });

    const isAdmin = (id: string) => adminMemberIds.has(id);

    const getGeneralUserId = (msg: { senderId: string; recipientId: string }) => {
      if (isAdmin(msg.senderId)) {
        return msg.recipientId;
      } else {
        return msg.senderId;
      }
    };

    // 件名から "Re: " や "(全会員)" などの修飾語をきれいに取り除く共通関数
    const normalizeSubject = (subj: string) => {
      return subj
        .replace(/^(re|ｒｅ):\s*/i, '')
        .replace(/^[（(]全会員[）)]\s*/i, '')
        .trim()
        .toLowerCase();
    };

    const threadList: any[] = [];

    allParsedMessages.forEach((msg) => {
      const isReply = /^Re:\s*/i.test(msg.subject) || msg.subject.toLowerCase().startsWith('re:');
      if (!isReply) {
        const generalUserId = getGeneralUserId(msg);
        threadList.push({
          ...msg,
          generalUserId,
          cleanSubject: normalizeSubject(msg.subject),
          replies: [],
        });
      }
    });

    threadList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    allParsedMessages.forEach((msg) => {
      const isReply = /^Re:\s*/i.test(msg.subject) || msg.subject.toLowerCase().startsWith('re:');
      if (isReply) {
        const generalUserId = getGeneralUserId(msg);
        const cleanSubject = normalizeSubject(msg.subject);
        const msgTime = new Date(msg.createdAt).getTime() || 0;

        const candidates = threadList.filter(
          (t) =>
            t.generalUserId === generalUserId &&
            t.cleanSubject === cleanSubject &&
            new Date(t.createdAt).getTime() <= msgTime
        );

        if (candidates.length > 0) {
          candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const targetParent = candidates[0];

          const exists = targetParent.id === msg.id || targetParent.replies.some((r: any) => r.id === msg.id);
          if (!exists) {
            targetParent.replies.push({
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
        } else {
          const fallbackCandidates = threadList.filter(
            (t) => t.generalUserId === generalUserId && t.cleanSubject === cleanSubject
          );
          if (fallbackCandidates.length > 0) {
            fallbackCandidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const targetParent = fallbackCandidates[0];
            const exists = targetParent.id === msg.id || targetParent.replies.some((r: any) => r.id === msg.id);
            if (!exists) {
              targetParent.replies.push({
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
        }
      }
    });

    // ★ 修正: 共通の 'admin' を除外し、現在ログイン中の管理者ID（currentMemberId）に完全に一致するもののみに絞り込む
    const isCurrentAdmin = (id: string) => {
      if (!id || !currentMemberId) return false;
      return String(id).trim() === String(currentMemberId).trim();
    };

    const filteredThreadList = threadList.filter((parent: any) => {
      const isParentInvolved =
        isCurrentAdmin(parent.senderId) || isCurrentAdmin(parent.recipientId);
      const hasReplyInvolved = parent.replies.some(
        (r: any) => isCurrentAdmin(r.senderId) || isCurrentAdmin(r.recipientId)
      );
      return isParentInvolved || hasReplyInvolved;
    });

    // 抽出後の filteredThreadList に対してソート処理を行う
    filteredThreadList.forEach((parent: any) => {
      parent.replies.sort((a: any, b: any) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      let latestTime = new Date(parent.createdAt).getTime() || 0;
      parent.replies.forEach((r: any) => {
        const rTime = new Date(r.createdAt).getTime() || 0;
        if (rTime > latestTime) {
          latestTime = rTime;
        }
      });
      parent._latestTimestamp = latestTime;
    });

    // スレッド自体の並び順は、最新のアクティビティ順にする
    filteredThreadList.sort((a: any, b: any) => {
      return b._latestTimestamp - a._latestTimestamp;
    });

    return NextResponse.json({ success: true, inquiries: filteredThreadList });
  } catch (error: any) {
    console.error('問い合わせ取得エラー:', error);
    return NextResponse.json({ success: false, error: error.message || '取得エラー' }, { status: 500 });
  }
}