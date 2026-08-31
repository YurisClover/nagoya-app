import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guards";
import { getSheetsClient } from "@/lib/sheets/googleapis";

export async function DELETE(request: Request) {
  try {
    const apiUser = await getApiUser();
    if (!apiUser) {
      return NextResponse.json(
        { success: false, error: "認証されていません" },
        { status: 401 },
      );
    }

    const { memberId, role } = apiUser;

    // DELETE carries the id in the query string: DELETE request bodies
    // have no defined semantics in HTTP and some proxies drop them.
    // Callers name only the root message - the parent_id walk below pulls
    // in every reply, so a client-supplied reply list is unnecessary
    // (each row is ownership-checked regardless).
    const messageId =
      new URL(request.url).searchParams.get("messageId")?.trim() ?? "";

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "messageId が指定されていません" },
        { status: 400 },
      );
    }

    const { sheets, spreadsheetId } = getSheetsClient();

    // Messagesシートの全データを取得（A:I列）
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Messages!A:I",
    });

    // 3. APIの戻り値を string[][] 型として明示
    const rows = (response.data.values as string[][]) || [];

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Messagesシートにデータがありません" },
        { status: 404 },
      );
    }

    const headers = (rows[0] || []).map((h) => h.toLowerCase().trim());
    let idIdx = headers.findIndex(
      (h) => h === "message_id" || h === "id" || h === "messageid",
    );
    let deleteFlagIdx = headers.findIndex(
      (h) => h === "delete_flag" || h === "deleteflag",
    );
    let parentIdIdx = headers.findIndex(
      (h) => h === "parent_id" || h === "parentid" || h === "parent",
    );

    let senderIdx = headers.findIndex(
      (h) => h === "sender_id" || h === "senderid" || h === "sender",
    );
    let recipientIdx = headers.findIndex(
      (h) => h === "recipient_id" || h === "recipientid" || h === "recipient",
    );

    if (idIdx === -1) idIdx = 0; // A列
    if (deleteFlagIdx === -1) deleteFlagIdx = 7; // H列 (index 7)
    if (parentIdIdx === -1) parentIdIdx = 8; // I列 (index 8)
    if (senderIdx === -1) senderIdx = 1; // B列
    if (recipientIdx === -1) recipientIdx = 2; // C列

    const colLetter = String.fromCharCode(65 + deleteFlagIdx);

    const targetIds = new Set<string>([messageId]);

    // ★ スプレッドシート内を走査し、削除対象のメッセージを親（parent_id）に持つ子メッセージも自動で巻き込む
    let added = true;
    while (added) {
      added = false;
      for (let i = 1; i < rows.length; i++) {
        const currentId = rows[i][idIdx]?.toString().trim();
        const parentId = rows[i][parentIdIdx]?.toString().trim();

        if (
          currentId &&
          parentId &&
          targetIds.has(parentId) &&
          !targetIds.has(currentId)
        ) {
          targetIds.add(currentId);
          added = true;
        }
      }
    }

    // 4. Promise<any>[] を Promise<unknown>[] に変更
    const updatePromises: Promise<unknown>[] = [];

    for (let i = 1; i < rows.length; i++) {
      const currentId = rows[i][idIdx]?.toString().trim();
      if (currentId && targetIds.has(currentId)) {
        // 所有チェック: admin は全行、一般会員は自分が当事者の行のみ削除できる
        // (UUID を知っているだけでは他人のメッセージを消せない)。
        const rowSender = rows[i][senderIdx]?.toString().trim() ?? "";
        const rowRecipient = rows[i][recipientIdx]?.toString().trim() ?? "";
        const canDelete =
          role === "admin" ||
          rowSender === memberId ||
          rowRecipient === memberId;
        if (!canDelete) continue;

        const rowIndex = i + 1; // スプレッドシートの行番号（1始まり）

        // H列（delete_flag）を 'true' に更新
        updatePromises.push(
          sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Messages!${colLetter}${rowIndex}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              // USER_ENTERED + 'TRUE' = UI で TRUE と入力したのと同じ → boolean セルになる。
              // (RAW は boolean を渡しても文字列化され 'TRUE 表示になるため使わない)
              values: [["TRUE"]],
            },
          }),
        );
      }
    }

    if (updatePromises.length === 0) {
      return NextResponse.json(
        { success: false, error: "該当メッセージが見つかりませんでした" },
        { status: 404 },
      );
    }

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: "メッセージおよびスレッド内の返信をすべて削除しました",
      deletedCount: updatePromises.length,
    });
  } catch (error: unknown) {
    // 5. catch句のエラーを unknown 型に変更し、安全に判定
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Delete Message Error:", errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
