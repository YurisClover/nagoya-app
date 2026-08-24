export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSheetsClient } from "@/lib/sheets/googleapis";

interface SessionUser {
  member_id?: string;
  id?: string;
  name?: string | null;
  email?: string | null;
}

type MessageStatus = 'unsupported' | 'pending' | 'closed';

interface ParsedMessage {
  id: string;
  parentId: string;
  senderId: string;
  recipientId: string;
  generalUserId: string;
  userName: string;
  memberId: string;
  senderName: string;
  recipientName: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  status: MessageStatus;
  lastStatusUpdatedBy?: string | null;
}

interface MessageThread extends ParsedMessage {
  replies: ParsedMessage[];
  _latestTimestamp?: number;
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    const currentMemberId = user?.member_id || user?.id;

    if (!session || !currentMemberId) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    // この一覧は事務局(admin)専用。ここを開けると全会員の問い合わせが
    // 一般会員から読めてしまうため、role で必ず遮断する。

    if (session.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
    }

    const myAdminId = String(currentMemberId).trim();
    const { sheets, spreadsheetId } = getSheetsClient(true);




    const [usersRes, messagesRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A1:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Messages!A1:Z' }),
    ]);

    const userRows = (usersRes.data.values || []) as unknown[][];
    const messageRows = (messagesRes.data.values || []) as unknown[][];

    const userHeaderRow = userRows[0] || [];
    const userHeader = userHeaderRow.map((h: unknown) => String(h).toLowerCase().trim());
    let uMemberIdIdx = userHeader.findIndex((h) => h === 'member_id' || h === 'id' || h === 'memberid');
    let uNameIdx = userHeader.findIndex((h) => h === 'name' || h === 'username' || h === 'user_name');
    const uRoleIdx = userHeader.findIndex((h) => h === 'role');

    if (uMemberIdIdx === -1) uMemberIdIdx = 0;
    if (uNameIdx === -1) uNameIdx = 1;

    const userMap: Record<string, { name: string; memberId: string }> = {};
    // 'admin' リテラル宛てのみ初期登録。admin の会員IDは Users シートの role 列から
    // 動的に集める(IDのハードコード禁止)。呼び出し元は上で role 検証済み。
    const adminMemberIds = new Set<string>(['admin']);

    userRows.slice(1).forEach((row: unknown[]) => {
      const mId = row[uMemberIdIdx] != null ? String(row[uMemberIdIdx]).trim() : '';
      const name = row[uNameIdx] != null ? String(row[uNameIdx]).trim() : '';
      const role = uRoleIdx !== -1 && row[uRoleIdx] != null ? String(row[uRoleIdx]).trim().toLowerCase() : '';

      if (mId) {
        userMap[mId] = { name: name || mId, memberId: mId };
        if (role === 'admin') adminMemberIds.add(mId.toLowerCase());
      }
    });

    const msgHeaderRow = messageRows[0] || [];
    const msgHeader = msgHeaderRow.map((h: unknown) => String(h).toLowerCase().trim());
    let idIdx = msgHeader.findIndex((h) => h === 'message_id' || h === 'id' || h === 'messageid');
    let senderIdIdx = msgHeader.findIndex((h) => h === 'sender_id' || h === 'senderid' || h === 'sender');
    let recipientIdIdx = msgHeader.findIndex((h) => h === 'recipient_id' || h === 'recipientid' || h === 'recipient');
    let titleIdx = msgHeader.findIndex((h) => h === 'title' || h === 'subject');
    let bodyIdx = msgHeader.findIndex((h) => h === 'body' || h === 'content');
    let isReadIdx = msgHeader.findIndex((h) => h === 'is_read' || h === 'isread' || h === 'read');
    let createdAtIdx = msgHeader.findIndex((h) => h === 'created_at' || h === 'createdat' || h === 'timestamp' || h === 'date');
    const deleteFlagIdx = msgHeader.findIndex((h) => h === 'delete_flag' || h === 'deleteflag' || h === 'is_deleted' || h === 'deleted');
    let parentIdIdx = msgHeader.findIndex((h) => h === 'parent_id' || h === 'parentid' || h === 'reply_to_id');
    let statusIdx = msgHeader.findIndex((h) => h === 'status');
    let lastStatusUpdatedByIdx = msgHeader.findIndex((h) => h === 'last_status_updated_by' || h === 'status_updated_by');

    if (idIdx === -1) idIdx = 0;
    if (senderIdIdx === -1) senderIdIdx = 1;
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (titleIdx === -1) titleIdx = 3;
    if (bodyIdx === -1) bodyIdx = 4;
    if (isReadIdx === -1) isReadIdx = 5;
    if (createdAtIdx === -1) createdAtIdx = 6;
    if (parentIdIdx === -1) parentIdIdx = 8;
    if (statusIdx === -1) statusIdx = 9;
    if (lastStatusUpdatedByIdx === -1) lastStatusUpdatedByIdx = 10;

    const parseTime = (dateStr: string): number => {
      if (!dateStr) return 0;
      let targetStr = dateStr.trim().replace(/-/g, '/');
      
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(targetStr)) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        targetStr = `${year}/${month}/${day} ${targetStr}`;
      }

      const t = new Date(targetStr).getTime();
      return isNaN(t) ? 0 : t;
    };

    const isAdmin = (id: string): boolean =>
      adminMemberIds.has((id || '').toLowerCase()) ||
      (id || '').toLowerCase() === myAdminId.toLowerCase();
    const getGeneralUserId = (senderId: string, recipientId: string): string => isAdmin(senderId) ? recipientId : senderId;

    const allParsedMessages: ParsedMessage[] = [];
    const seenMsgIds = new Set<string>();

    messageRows.slice(1).forEach((row: unknown[], index: number) => {
      if (deleteFlagIdx !== -1) {
        const deleteFlagVal = row[deleteFlagIdx] != null ? String(row[deleteFlagIdx]).trim().toLowerCase() : '';
        if (deleteFlagVal === 'true' || deleteFlagVal === '1') return;
      }

      const rawId = row[idIdx] != null ? String(row[idIdx]).trim() : '';
      const senderId = row[senderIdIdx] != null ? String(row[senderIdIdx]).trim() : '';
      const recipientId = row[recipientIdIdx] != null ? String(row[recipientIdIdx]).trim() : '';
      
      if (senderId && recipientId && senderId.toLowerCase() === recipientId.toLowerCase()) return;

      const messageId = rawId || `msg-${index}`;
      if (seenMsgIds.has(messageId)) return;
      seenMsgIds.add(messageId);

      // 表示上の「相手」を決める:
      //   閲覧者(admin)が送信者なら相手は受信者、そうでなければ送信者。
      //   これで一斉送信(sender=admin)でも各行に受信者名が出る。
      const counterpartId = getGeneralUserId(senderId, recipientId);
      const counterpartInfo = userMap[counterpartId] || { name: counterpartId || '不明', memberId: counterpartId };

      const senderInfo = userMap[senderId] || { name: senderId || '不明', memberId: senderId };
      let recipientName = '不明';
      const rIdLower = recipientId.toLowerCase();
      if (rIdLower === 'all' || rIdLower === '全体') recipientName = '全会員';
      else if (rIdLower === 'admin') recipientName = '事務局';
      else if (userMap[recipientId]) recipientName = userMap[recipientId].name;
      else recipientName = recipientId;

      // 一斉送信(all/全体)は相手が特定の1人ではないので「全会員」をラベルにする
      const counterpartLabel =
        rIdLower === 'all' || rIdLower === '全体' ? '全会員' : counterpartInfo.name;

      const isReadVal = row[isReadIdx] != null ? String(row[isReadIdx]).trim().toLowerCase() : '';
      let isRead = isReadVal === 'true' || isReadVal === '1' || isReadVal === '既読';
      if (senderId.toLowerCase() === myAdminId.toLowerCase()) isRead = true;

      const rawStatus = row[statusIdx] != null ? String(row[statusIdx]).trim().toLowerCase() : '';
      const status: MessageStatus = 
        rawStatus === 'pending' || rawStatus === 'closed' || rawStatus === 'unsupported' 
          ? (rawStatus as MessageStatus)
          : 'unsupported';

      const rawUpdaterId = row[lastStatusUpdatedByIdx] != null ? String(row[lastStatusUpdatedByIdx]).trim() : null;
      let lastStatusUpdatedBy = rawUpdaterId;
      if (rawUpdaterId && userMap[rawUpdaterId]) {
        lastStatusUpdatedBy = userMap[rawUpdaterId].name;
      }

      const parentIdVal = row[parentIdIdx] != null ? String(row[parentIdIdx]).trim() : '';
      const subjectVal = row[titleIdx] != null ? String(row[titleIdx]).trim() : '';
      const bodyVal = row[bodyIdx] != null ? String(row[bodyIdx]).trim() : '';
      const createdAtVal = row[createdAtIdx] != null ? String(row[createdAtIdx]).trim() : '';

      allParsedMessages.push({
        id: messageId,
        parentId: parentIdVal,
        senderId,
        recipientId,
        generalUserId: counterpartId,
        userName: counterpartLabel,
        memberId: counterpartInfo.memberId,
        senderName: senderInfo.name,
        recipientName,
        subject: subjectVal,
        body: bodyVal,
        isRead,
        createdAt: createdAtVal,
        status,
        lastStatusUpdatedBy,
      });
    });

    const threadMap = new Map<string, MessageThread>();
    const threadList: MessageThread[] = [];

    allParsedMessages.forEach((msg) => {
      if (!msg.parentId) {
        const newThread: MessageThread = { ...msg, replies: [] };
        threadMap.set(msg.id, newThread);
        threadList.push(newThread);
      }
    });

    allParsedMessages.forEach((msg) => {
      if (!msg.parentId) return;
      const targetParent = threadMap.get(msg.parentId);
      if (targetParent) {
        if (!targetParent.replies.some((r) => r.id === msg.id)) targetParent.replies.push(msg);
      } else {
        threadList.push({ ...msg, replies: [] });
      }
    });

    const myRelatedThreads = threadList.filter((parent) => {
      const parentRecipient = (parent.recipientId || '').toLowerCase();
      
      if (isAdmin(myAdminId)) {
        if (parentRecipient === 'admin' || parentRecipient === 'all' || parentRecipient === '全体') return true;
      }
      
      const myId = myAdminId.toLowerCase();
      return parent.senderId.toLowerCase() === myId || parent.recipientId.toLowerCase() === myId || parentRecipient === 'all' || parentRecipient === '全体';
    });

    myRelatedThreads.forEach((parent) => {
      parent.replies.sort((a, b) => parseTime(a.createdAt) - parseTime(b.createdAt));
      let latestTime = parseTime(parent.createdAt);
      parent.replies.forEach((r) => {
        const rTime = parseTime(r.createdAt);
        if (rTime > latestTime) latestTime = rTime;
      });
      parent._latestTimestamp = latestTime;
    });

    myRelatedThreads.sort((a, b) => (b._latestTimestamp || 0) - (a._latestTimestamp || 0));

    return NextResponse.json({ success: true, inquiries: myRelatedThreads });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('問い合わせ取得エラー:', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage || '取得エラー' }, { status: 500 });
  }
}