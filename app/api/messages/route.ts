import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSheetsClient } from "@/lib/sheets/googleapis";

// 405エラーや静的判定を防ぐため、必ず動的レンダリングを指定します
export const dynamic = "force-dynamic";

// 1. データの型定義
type ParsedMessage = {
  id: string;
  parentId: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string;
  recipient_name: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  is_deleted: boolean;
  status: string; // ★追加
  last_status_updated_by: string; // ★追加
};

type Thread = ParsedMessage & {
  replies: ParsedMessage[];
  _latestTimestamp?: number;
};

type SessionUser = {
  member_id?: string;
  id?: string;
  name?: string | null;
  email?: string | null;
};

export async function GET() {
  try {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    const currentMemberId = user?.member_id || user?.id;

    if (!session || !currentMemberId) {
      return NextResponse.json(
        { success: false, error: "認証されていません。" },
        { status: 401 }
      );
    }

    const { sheets, spreadsheetId } = getSheetsClient(true);




    // Messages シート と Users シートを並行取得
    const [messagesRes, usersRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Messages!A1:Z",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Users!A:Z",
      }),
    ]);

    const messageRows = (messagesRes.data.values as string[][]) || [];
    const userRows = (usersRes.data.values as string[][]) || [];

    if (messageRows.length <= 1) {
      return NextResponse.json({ success: true, messages: [] });
    }

    // Users のマップ作成 (member_id -> user_name, および管理者判定用)
    const uHeaders = (userRows[0] || []).map((h) => h.toLowerCase().trim());
    let uMemberIdIdx = uHeaders.findIndex((h) => h === "member_id" || h === "id" || h === "memberid");
    let uNameIdx = uHeaders.findIndex((h) => h === "user_name" || h === "username" || h === "name");
    let uRoleIdx = uHeaders.findIndex((h) => h === "role");

    if (uMemberIdIdx === -1) uMemberIdIdx = 0;
    if (uNameIdx === -1) uNameIdx = 1;

    const userNameMap = new Map<string, string>();
    const adminMemberIds = new Set<string>(["admin", "10001234"]);

    userRows.slice(1).forEach((row) => {
      const mId = row[uMemberIdIdx]?.toString().trim();
      const uName = row[uNameIdx]?.toString().trim();
      const role = uRoleIdx !== -1 ? row[uRoleIdx]?.toString().trim().toLowerCase() : "";

      if (mId) {
        userNameMap.set(mId, uName || mId);
        if (role === "admin") {
          adminMemberIds.add(mId.toLowerCase());
        }
      }
    });

    const myUserId = String(currentMemberId).trim();
    const isMySelfAdmin = adminMemberIds.has(myUserId.toLowerCase());

    // Messages ヘッダーの列位置を取得
    const msgHeaders = messageRows[0].map((h) => h.toLowerCase().replace(/[_-\s]/g, "").trim());
    let idIdx = msgHeaders.findIndex((h) => h === "messageid" || h === "id");
    let senderIdIdx = msgHeaders.findIndex((h) => h === "senderid" || h === "sender");
    let recipientIdIdx = msgHeaders.findIndex((h) => h === "recipientid" || h === "recipient");
    let titleIdx = msgHeaders.findIndex((h) => h === "title" || h === "subject");
    let bodyIdx = msgHeaders.findIndex((h) => h === "body" || h === "content");
    let isReadIdx = msgHeaders.findIndex((h) => h === "isread" || h === "read");
    let createdAtIdx = msgHeaders.findIndex((h) => h === "createdat" || h === "date");
    let deleteFlagIdx = msgHeaders.findIndex((h) => h === "deleteflag" || h === "deleted");
    let parentIdIdx = msgHeaders.findIndex((h) => h === "parentid" || h === "parent");
    // ★追加: ステータスと更新者の列インデックス検出
    let statusIdx = msgHeaders.findIndex((h) => h === "status");
    let lastStatusUpdatedByIdx = msgHeaders.findIndex((h) => h === "laststatusupdatedby" || h === "statusupdatedby");

    if (idIdx === -1) idIdx = 0;
    if (senderIdIdx === -1) senderIdIdx = 1;
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (titleIdx === -1) titleIdx = 3;
    if (bodyIdx === -1) bodyIdx = 4;
    if (isReadIdx === -1) isReadIdx = 5;
    if (createdAtIdx === -1) createdAtIdx = 6;
    if (deleteFlagIdx === -1) deleteFlagIdx = 7;
    if (parentIdIdx === -1) parentIdIdx = 8;

    // メッセージのオブジェクト化
    const allMessages: ParsedMessage[] = messageRows
      .slice(1)
      .map((row, index) => {
        const isReadRaw = row[isReadIdx]?.toString().trim().toLowerCase() || "false";
        const isRead = isReadRaw === "true" || isReadRaw === "1" || isReadRaw === "既読";

        const deleteFlagRaw = row[deleteFlagIdx]?.toString().trim().toLowerCase() || "false";
        const isDeleted = deleteFlagRaw === "true" || deleteFlagRaw === "1";

        const senderId = row[senderIdIdx]?.toString().trim() || "";
        const recipientId = row[recipientIdIdx]?.toString().trim() || "";
        const parentId = row[parentIdIdx]?.toString().trim() || "";

        const senderName = userNameMap.get(senderId) || senderId;
        
        let recipientName = "不明";
        const rIdLower = recipientId.toLowerCase();
        if (rIdLower === "all" || recipientId === "全体") {
          recipientName = "全会員";
        } else if (rIdLower === "admin") {
          recipientName = "事務局";
        } else {
          recipientName = userNameMap.get(recipientId) || recipientId;
        }

        // ★追加: ステータスと更新者の取得（デフォルトは unsupported / 未対応）
        const status = statusIdx !== -1 && row[statusIdx] ? row[statusIdx].toString().trim() : "unsupported";
        const lastStatusUpdatedBy = lastStatusUpdatedByIdx !== -1 && row[lastStatusUpdatedByIdx] ? row[lastStatusUpdatedByIdx].toString().trim() : "";

        return {
          id: row[idIdx]?.toString().trim() || `msg-${index}`,
          parentId,
          sender_id: senderId,
          recipient_id: recipientId,
          sender_name: senderName,
          recipient_name: recipientName,
          title: row[titleIdx]?.toString().trim() || "",
          body: row[bodyIdx]?.toString().trim() || "",
          is_read: isRead,
          created_at: row[createdAtIdx]?.toString().trim() || "",
          is_deleted: isDeleted,
          status,
          last_status_updated_by: lastStatusUpdatedBy,
        };
      })
      .filter((m) => !m.is_deleted);

    // スレッド構築
    const threadMap = new Map<string, Thread>();
    const threadList: Thread[] = [];

    allMessages.forEach((msg) => {
      if (!msg.parentId) {
        const parentObj: Thread = {
          ...msg,
          replies: [],
        };
        threadMap.set(msg.id, parentObj);
        threadList.push(parentObj);
      }
    });

    allMessages.forEach((msg) => {
      if (!msg.parentId) return;

      const parentThread = threadMap.get(msg.parentId);
      if (parentThread) {
        const exists = parentThread.replies.some((r) => r.id === msg.id);
        if (!exists) {
          parentThread.replies.push(msg);
        }
      } else {
        const fallbackParent = threadList.find(
          (t) =>
            t.title.replace(/^Re:\s*/i, "").trim().toLowerCase() ===
            msg.title.replace(/^Re:\s*/i, "").trim().toLowerCase()
        );
        if (fallbackParent) {
          fallbackParent.replies.push(msg);
        } else {
          threadList.push({
            ...msg,
            replies: [],
          });
        }
      }
    });

    // 自分に関係するスレッドに絞り込み（管理者の場合は 'admin' 宛ても対象）
    const myRelatedThreads = threadList.filter((parent) => {
      const allMsgsInThread: ParsedMessage[] = [parent, ...parent.replies];
      return allMsgsInThread.some((m) => {
        const recId = (m.recipient_id || "").toLowerCase();
        const senderId = (m.sender_id || "").toLowerCase();
        const myId = myUserId.toLowerCase();

        return (
          recId === myId ||
          recId === "all" ||
          recId === "全体" ||
          senderId === myId ||
          (isMySelfAdmin && recId === "admin")
        );
      });
    });

    // 日時ソートとレスポンスの整形
    const parseTime = (dateStr: string) => {
      if (!dateStr) return 0;
      const t = new Date(dateStr.replace(/-/g, "/")).getTime();
      return isNaN(t) ? 0 : t;
    };

    const formattedThreads = myRelatedThreads.map((parent) => {
      parent.replies.sort((a, b) => parseTime(a.created_at) - parseTime(b.created_at));

      let latestTime = parseTime(parent.created_at);
      parent.replies.forEach((r) => {
        const rTime = parseTime(r.created_at);
        if (rTime > latestTime) latestTime = rTime;
      });
      parent._latestTimestamp = latestTime;

      const parentIsRead = parent.sender_id === myUserId ? true : parent.is_read;

      return {
        message_id: parent.id,
        sender_id: parent.sender_id,
        recipient_id: parent.recipient_id,
        sender_name: parent.sender_name,
        recipient_name: parent.recipient_name,
        title: parent.title,
        body: parent.body,
        is_read: parentIsRead,
        created_at: parent.created_at,
        status: parent.status, // ★追加: 親メッセージのステータスを返す
        last_status_updated_by: parent.last_status_updated_by, // ★追加
        _latestTimestamp: parent._latestTimestamp,
        replies: parent.replies.map((r) => {
          const replyIsRead = r.sender_id === myUserId ? true : r.is_read;
          return {
            reply_id: r.id,
            sender_id: r.sender_id,
            recipient_id: r.recipient_id,
            sender_name: r.sender_name,
            recipient_name: r.recipient_name,
            title: r.title,
            body: r.body,
            is_read: replyIsRead,
            created_at: r.created_at,
          };
        }),
      };
    });

    formattedThreads.sort((a, b) => (b._latestTimestamp || 0) - (a._latestTimestamp || 0));

    return NextResponse.json({
      success: true,
      messages: formattedThreads,
    });
  } catch (error: unknown) {
    console.error(
      "メッセージ取得エラー:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      { success: false, error: "メッセージの取得に失敗しました。" },
      { status: 500 }
    );
  }
}