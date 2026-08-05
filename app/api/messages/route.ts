import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/auth";

export async function GET() {
  try {
    // 1. セッションの取得（ログインユーザー判定）
    const session = await auth();
    const currentMemberId = (session?.user as any)?.member_id || session?.user?.id;

    if (!session || !currentMemberId) {
      return NextResponse.json(
        { success: false, error: "認証されていません。" },
        { status: 401 }
      );
    }

    // 2. Google API 認証情報
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: "環境変数が不足しています。" },
        { status: 500 }
      );
    }

    const authClient = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth: authClient });

    // 3. Messages シートと Users シートを並行取得
    const [messagesRes, usersRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Messages!A:H",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Users!A:Z",
      }),
    ]);

    const messageRows = messagesRes.data.values || [];
    const userRows = usersRes.data.values || [];

    if (messageRows.length <= 1) {
      return NextResponse.json({ success: true, messages: [] });
    }

    // Users のマップ作成
    const uHeaders = (userRows[0] || []).map((h: string) => h.toLowerCase().trim());
    let uMemberIdIdx = uHeaders.findIndex((h) => h === "member_id" || h === "id" || h === "memberid");
    let uNameIdx = uHeaders.findIndex((h) => h === "user_name" || h === "username" || h === "name");

    if (uMemberIdIdx === -1) uMemberIdIdx = 0;
    if (uNameIdx === -1) uNameIdx = 1;

    const userNameMap = new Map<string, string>();
    userRows.slice(1).forEach((row) => {
      const mId = row[uMemberIdIdx]?.toString().trim();
      const uName = row[uNameIdx]?.toString().trim();
      if (mId) userNameMap.set(mId, uName || "事務局");
    });

    // Messages ヘッダーの列位置を取得
    const msgHeaders = messageRows[0].map((h: string) => h.toLowerCase().replace(/[_-\s]/g, "").trim());
    let idIdx = msgHeaders.findIndex((h) => h === "messageid" || h === "id");
    let senderIdIdx = msgHeaders.findIndex((h) => h === "senderid" || h === "sender");
    let recipientIdIdx = msgHeaders.findIndex((h) => h === "recipientid" || h === "recipient");
    let titleIdx = msgHeaders.findIndex((h) => h === "title" || h === "subject");
    let bodyIdx = msgHeaders.findIndex((h) => h === "body" || h === "content");
    let isReadIdx = msgHeaders.findIndex((h) => h === "isread" || h === "read");
    let createdAtIdx = msgHeaders.findIndex((h) => h === "createdat" || h === "date");
    let deleteFlagIdx = msgHeaders.findIndex((h) => h === "deleteflag" || h === "deleted");

    if (idIdx === -1) idIdx = 0;
    if (senderIdIdx === -1) senderIdIdx = 1;
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (titleIdx === -1) titleIdx = 3;
    if (bodyIdx === -1) bodyIdx = 4;
    if (isReadIdx === -1) isReadIdx = 5;
    if (createdAtIdx === -1) createdAtIdx = 6;
    if (deleteFlagIdx === -1) deleteFlagIdx = 7;

    const myUserId = String(currentMemberId).trim();

    // 4. すべての有効なメッセージをオブジェクト化
    const allMessages = messageRows.slice(1).map((row) => {
      const isReadRaw = row[isReadIdx]?.toString().trim().toLowerCase() || "";
      const isRead = isReadRaw === "true" || isReadRaw === "1" || isReadRaw === "既読";
      const deleteFlagRaw = row[deleteFlagIdx]?.toString().trim().toLowerCase() || "";
      const isDeleted = deleteFlagRaw === "true" || deleteFlagRaw === "1";

      const senderId = row[senderIdIdx]?.toString().trim() || "";
      const recipientId = row[recipientIdIdx]?.toString().trim() || "";

      return {
        id: row[idIdx]?.toString().trim() || "",
        sender_id: senderId,
        recipient_id: recipientId,
        sender_name: userNameMap.get(senderId) || (senderId === "10001234" ? "事務局" : senderId),
        title: row[titleIdx]?.toString().trim() || "",
        body: row[bodyIdx]?.toString().trim() || "",
        is_read: isRead,
        created_at: row[createdAtIdx]?.toString().trim() || "",
        is_deleted: isDeleted,
      };
    }).filter(m => !m.is_deleted);

    // 5. 件名から "Re: " や "(全会員)" などの修飾語をきれいに取り除く正規化関数
    const normalizeSubject = (subj: string) => {
      return subj
        .replace(/^(re|ｒｅ):\s*/i, "")
        .replace(/^[（(]全会員[）)]\s*/i, "")
        .trim()
        .toLowerCase();
    };

    const threadList: any[] = [];

    // 6. 親スレッド（Re: がついていないもの、または新規の起点）を時系列順に抽出
    allMessages.forEach((msg) => {
      const isReply = /^Re:\s*/i.test(msg.title) || msg.title.toLowerCase().startsWith('re:');
      if (!isReply) {
        threadList.push({
          ...msg,
          cleanSubject: normalizeSubject(msg.title),
          replies: [],
        });
      }
    });

    threadList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 7. 返信メッセージを正しい親スレッドに紐づける
    allMessages.forEach((msg) => {
      const isParent = threadList.some((t) => t.id === msg.id);
      if (isParent) return; // 親として登録済みのものはスキップ

      const cleanSubject = normalizeSubject(msg.title);
      const msgTime = new Date(msg.created_at).getTime() || 0;

      // 同じ正規化件名を持ち、送信日時が親以降のものを候補にする
      let candidates = threadList.filter(
        (t) =>
          t.cleanSubject === cleanSubject &&
          new Date(t.created_at).getTime() <= msgTime
      );

      // 一致する候補がない場合のフォールバック（直近のスレッドを探す）
      if (candidates.length === 0) {
        candidates = threadList.filter(
          (t) => new Date(t.created_at).getTime() <= msgTime
        );
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const targetParent = candidates[0];

        const exists = targetParent.id === msg.id || targetParent.replies.some((r: any) => r.id === msg.id);
        if (!exists) {
          targetParent.replies.push({
            id: msg.id,
            sender_id: msg.sender_id,
            recipient_id: msg.recipient_id,
            sender_name: msg.sender_name,
            title: msg.title,
            body: msg.body,
            is_read: msg.is_read,
            created_at: msg.created_at,
          });
        }
      }
    });

    // 8. 【重要】スレッド内に「自分宛て（自分が受信者、または全会員宛て）」のメッセージが1つでも含まれるものだけに絞り込む
    const myRelatedThreads = threadList.filter((parent) => {
      const allMsgsInThread = [parent, ...parent.replies];
      const hasReceivedMessage = allMsgsInThread.some((m: any) => {
        const recId = m.recipient_id.toLowerCase();
        return recId === myUserId.toLowerCase() || recId === "all" || recId === "全体";
      });
      return hasReceivedMessage;
    });

    // 9. 各スレッドの返信を古い順にソートし、最終アクティビティ順に並び替え
    const formattedThreads = myRelatedThreads.map((parent) => {
      parent.replies.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let latestTime = new Date(parent.created_at).getTime() || 0;
      parent.replies.forEach((r: any) => {
        const rTime = new Date(r.created_at).getTime() || 0;
        if (rTime > latestTime) latestTime = rTime;
      });
      parent._latestTimestamp = latestTime;

      const parentIsRead = parent.sender_id === myUserId ? true : parent.is_read;

      return {
        message_id: parent.id,
        sender_id: parent.sender_id,
        recipient_id: parent.recipient_id,
        sender_name: parent.sender_name,
        title: parent.title,
        body: parent.body,
        is_read: parentIsRead,
        created_at: parent.created_at,
        _latestTimestamp: parent._latestTimestamp,
        replies: parent.replies.map((r: any) => {
          const replyIsRead = r.sender_id === myUserId ? true : r.is_read;
          return {
            reply_id: r.id,
            sender_id: r.sender_id,
            sender_name: r.sender_name,
            title: r.title,
            body: r.body,
            is_read: replyIsRead,
            created_at: r.created_at,
          };
        }),
      };
    });

    formattedThreads.sort((a, b) => b._latestTimestamp - a._latestTimestamp);

    return NextResponse.json({
      success: true,
      messages: formattedThreads,
    });
  } catch (error: any) {
    console.error("一般用受信メッセージ取得エラー:", error);
    return NextResponse.json(
      { success: false, error: "メッセージの取得に失敗しました。" },
      { status: 500 }
    );
  }
}