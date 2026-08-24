export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guards";
import { getSheetsClient } from "@/lib/sheets/googleapis";

export async function GET() {
  try {
    // 1. セッションチェック
    const apiUser = await getApiUser();

    // 未ログインの場合は未読 0 件として返す
    if (!apiUser) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const currentMemberId = apiUser.memberId;

    // 2. Google API 認証情報の確認
    const { sheets, spreadsheetId } = getSheetsClient(true);




    // 3. Messages シートを取得
    const messagesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Messages!A1:Z",
    });

    const messageRows = (messagesRes.data.values || []) as unknown[][];
    if (messageRows.length <= 1) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 4. ヘッダー行から各列のインデックスを取得
    const headerRow = messageRows[0] || [];
    const msgHeader = headerRow.map((h: unknown) =>
      String(h).toLowerCase().replace(/[_-\s]/g, "").trim()
    );

    let recipientIdIdx = msgHeader.findIndex((h) => h === "recipientid" || h === "recipient");
    let senderIdIdx = msgHeader.findIndex((h) => h === "senderid" || h === "sender");
    let isReadIdx = msgHeader.findIndex((h) => h === "isread" || h === "read");
    let deleteFlagIdx = msgHeader.findIndex((h) => h === "deleteflag" || h === "deleted");

    // フォールバック（スプレッドシートの列構成に合わせて適宜調整してください）
    if (recipientIdIdx === -1) recipientIdIdx = 2; // C列付近の想定
    if (senderIdIdx === -1) senderIdIdx = 1;       // B列付近の想定
    if (isReadIdx === -1) isReadIdx = 5;           // F列付近の想定
    if (deleteFlagIdx === -1) deleteFlagIdx = 7;   // H列付近の想定

    let unreadCount = 0;

    // 5. ご指定の条件判定
    messageRows.slice(1).forEach((row) => {
      const recipientId = row[recipientIdIdx]?.toString().trim() || "";
      const senderId = row[senderIdIdx]?.toString().trim() || "";
      const isReadRaw = row[isReadIdx]?.toString().trim().toLowerCase() || "";
      const deleteFlagRaw = row[deleteFlagIdx]?.toString().trim().toLowerCase() || "";

      // 条件1: is_read が false かどうか ("true", "1", "既読" 以外を未読とする)
      const isRead = isReadRaw === "true" || isReadRaw === "1" || isReadRaw === "既読";
      const isUnread = !isRead;

      // 条件2: delete_flag が false かどうか ("true", "1" 以外を未削除とする)
      const isDeleted = deleteFlagRaw === "true" || deleteFlagRaw === "1";
      const isNotDeleted = !isDeleted;

      // 条件3: recipient_id がログイン中のユーザーの member_id かどうか
      const isValidRecipient = recipientId === String(currentMemberId).trim();

      // 条件4: 自分が送信した行は数えない(一覧側の既読定義と一致させる)
      const isNotMine = senderId !== String(currentMemberId).trim();

      // すべての条件を満たしている場合にカウントを増やす
      if (isUnread && isNotDeleted && isValidRecipient && isNotMine) {
        unreadCount++;
      }
    });

    return NextResponse.json({ success: true, count: unreadCount });
  } catch (error: unknown) {
    console.error("未読カウント取得エラー:", error);
    return NextResponse.json({ success: false, count: 0 }, { status: 500 });
  }
}