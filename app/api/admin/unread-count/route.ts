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
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

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
    let isReadIdx = msgHeader.findIndex((h) => h === "isread" || h === "read");
    let deleteFlagIdx = msgHeader.findIndex((h) => h === "deleteflag" || h === "deleted");

    // フォールバック（スプレッドシートの標準列位置: C列=2, F列=5, H列=7）
    if (recipientIdIdx === -1) recipientIdIdx = 2;
    if (isReadIdx === -1) isReadIdx = 5;
    if (deleteFlagIdx === -1) deleteFlagIdx = 7;

    let unreadCount = 0;

    // 5. 条件判定（自分宛 × 未読 × 未削除）
    messageRows.slice(1).forEach((row) => {
      const recipientId = row[recipientIdIdx]?.toString().trim() || "";
      const isReadRaw = row[isReadIdx]?.toString().trim().toLowerCase() || "";
      const deleteFlagRaw = row[deleteFlagIdx]?.toString().trim().toLowerCase() || "";

      // 条件1: ログインユーザー宛てか
      const isForMe = recipientId === String(currentMemberId).trim();

      // 条件2: 既読か
      const isRead = isReadRaw === "true" || isReadRaw === "1" || isReadRaw === "既読";

      // 条件3: 削除されているか
      const isDeleted = deleteFlagRaw === "true" || deleteFlagRaw === "1";

      // ★ 削除されておらず (!isDeleted)、かつ未読 (!isRead) のものだけをカウント
      if (isForMe && !isRead && !isDeleted) {
        unreadCount++;
      }
    });

    return NextResponse.json({ success: true, count: unreadCount });
  } catch (error: unknown) {
    console.error("未読カウント取得エラー:", error);
    return NextResponse.json({ success: false, count: 0 }, { status: 500 });
  }
}