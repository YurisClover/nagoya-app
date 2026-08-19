import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/auth";

export async function GET() {
  try {
    // 1. セッションチェック
    const session = await auth();
    const currentMemberId = session?.user?.id;

    // 未ログインの場合は未読 0 件として返す
    if (!session || !currentMemberId) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 2. Google API 認証情報の確認
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, count: 0 });
    }

    const googleAuth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth: googleAuth });

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
      const isReadRaw = row[isReadIdx]?.toString().trim().toLowerCase() || "";
      const deleteFlagRaw = row[deleteFlagIdx]?.toString().trim().toLowerCase() || "";

      // 条件1: is_read が false かどうか ("true", "1", "既読" 以外を未読とする)
      const isRead = isReadRaw === "true" || isReadRaw === "1" || isReadRaw === "既読";
      const isUnread = !isRead;

      // 条件2: delete_flag が false かどうか ("true", "1" 以外を未削除とする)
      const isDeleted = deleteFlagRaw === "true" || deleteFlagRaw === "1";
      const isNotDeleted = !isDeleted;

      // 条件3: recipient_id が "admin" もしくはログイン中のユーザーの member_id かどうか
      const isValidRecipient = recipientId === "admin" || recipientId === String(currentMemberId).trim();

      // すべての条件を満たしている場合にカウントを増やす
      if (isUnread && isNotDeleted && isValidRecipient) {
        unreadCount++;
      }
    });

    return NextResponse.json({ success: true, count: unreadCount });
  } catch (error: unknown) {
    console.error("未読カウント取得エラー:", error);
    return NextResponse.json({ success: false, count: 0 }, { status: 500 });
  }
}