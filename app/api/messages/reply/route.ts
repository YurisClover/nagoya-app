import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guards";
import crypto from "crypto";
import { nowJST } from "@/lib/datetime";
import { getSheetsClient } from "@/lib/sheets/googleapis";

interface ReplyRequestBody {
  parentMessageId?: string;
  recipientId?: string;
  title?: string;
  body?: string;
}

export async function POST(req: Request) {
  try {
    const apiUser = await getApiUser();

    if (!apiUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const bodyData = (await req.json()) as ReplyRequestBody;
    const { parentMessageId, recipientId, title, body } = bodyData;

    if (!body) {
      return NextResponse.json(
        { success: false, error: "本文が不足しています" },
        { status: 400 },
      );
    }

    const { sheets, spreadsheetId } = getSheetsClient();

    const messageId = crypto.randomUUID();

    // ★ lib/datetime.ts の nowJST() を使用して日時を生成
    const createdAt = nowJST();

    // なりすまし防止: sender はリクエストボディではなく必ずセッションから取る
    const senderId = apiUser.memberId;

    const messagesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Messages!A:I",
    });

    const rows = (messagesRes.data.values as string[][]) || [];

    let resolvedRecipientId = recipientId;
    let finalTitle = title?.trim();
    const resolvedParentId = parentMessageId || "";
    // Sheet row number of the parent message (0 = not found). rows[0] is
    // the header, so data index i corresponds to sheet row i + 1.
    let parentSheetRow = 0;

    if (rows.length > 1) {
      const headers = (rows[0] || []).map((h) =>
        h
          .toLowerCase()
          .replace(/[_-\s]/g, "")
          .trim(),
      );
      let mIdIdx = headers.findIndex((h) => h === "messageid" || h === "id");
      let sIdIdx = headers.findIndex((h) => h === "senderid" || h === "sender");
      let rIdIdx = headers.findIndex(
        (h) => h === "recipientid" || h === "recipient",
      );
      let tIdx = headers.findIndex((h) => h === "title" || h === "subject");

      if (mIdIdx === -1) mIdIdx = 0;
      if (sIdIdx === -1) sIdIdx = 1;
      if (rIdIdx === -1) rIdIdx = 2;
      if (tIdx === -1) tIdx = 3;

      if (resolvedParentId) {
        const parentRowIndex = rows.findIndex(
          (r) => r[mIdIdx]?.toString().trim() === resolvedParentId,
        );
        const parentRow =
          parentRowIndex >= 0 ? rows[parentRowIndex] : undefined;
        if (parentRow) {
          parentSheetRow = parentRowIndex + 1;
          const pSender = parentRow[sIdIdx]?.toString().trim();
          const pRecipient = parentRow[rIdIdx]?.toString().trim();
          const pTitle = parentRow[tIdx]?.toString().trim();

          // Only thread participants may reply. Admins pass regardless:
          // inquiry threads are addressed to the literal recipient 'admin',
          // so an admin's own member id never appears on the parent row.
          // Unguessable UUIDs alone are not an authorization mechanism.
          const isParticipant =
            apiUser.role === "admin" ||
            pSender === senderId ||
            pRecipient === senderId;
          if (!isParticipant) {
            return NextResponse.json(
              {
                success: false,
                error: "このスレッドに返信する権限がありません。",
              },
              { status: 403 },
            );
          }

          if (!resolvedRecipientId || resolvedRecipientId === senderId) {
            resolvedRecipientId = pSender === senderId ? pRecipient : pSender;
          }
          if (!finalTitle && pTitle) {
            const cleanT = pTitle.replace(/^Re:\s*/i, "");
            finalTitle = `Re: ${cleanT}`;
          }
        }
      }

      if (
        !resolvedRecipientId ||
        String(resolvedRecipientId).trim() === String(senderId).trim()
      ) {
        for (let i = rows.length - 1; i >= 1; i--) {
          const row = rows[i];
          const s = row[sIdIdx]?.toString().trim();
          const r = row[rIdIdx]?.toString().trim();
          if (r === senderId && s && s !== senderId) {
            resolvedRecipientId = s;
            break;
          } else if (s === senderId && r && r !== senderId) {
            resolvedRecipientId = r;
            break;
          }
        }
      }

      if (!finalTitle && resolvedRecipientId) {
        for (let i = rows.length - 1; i >= 1; i--) {
          const row = rows[i];
          const s = row[sIdIdx]?.toString().trim();
          const r = row[rIdIdx]?.toString().trim();
          const t = row[tIdx]?.toString().trim();
          if (
            ((s === senderId && r === resolvedRecipientId) ||
              (s === resolvedRecipientId && r === senderId)) &&
            t
          ) {
            const cleanT = t.replace(/^Re:\s*/i, "");
            finalTitle = `Re: ${cleanT}`;
            break;
          }
        }
      }
    }

    if (
      !resolvedRecipientId ||
      String(resolvedRecipientId).trim() === String(senderId).trim()
    ) {
      return NextResponse.json(
        { success: false, error: "送信先が正しく特定できません" },
        { status: 400 },
      );
    }

    if (!finalTitle) finalTitle = "（件名なし）";

    const isRead =
      String(senderId).trim() === String(resolvedRecipientId).trim();

    const newRow = [
      messageId,
      String(senderId),
      resolvedRecipientId,
      finalTitle,
      body,
      isRead,
      createdAt,
      false,
      resolvedParentId,
    ];

    // 行全体は RAW で追加する(USER_ENTERED だと日時文字列が date serial に変換され
    // 読み取りが壊れる)。RAW では boolean も 'TRUE という文字列になるため、
    // 追加直後に F(is_read)/H(delete_flag)だけ USER_ENTERED で boolean セル化する。
    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Messages!A1:I",
      valueInputOption: "RAW",
      requestBody: { values: [newRow] },
    });

    // 失敗しても文字列の 'TRUE/'FALSE が残るだけで読み取り側は動くため、警告に留める。
    try {
      const updatedRange = appendResult.data.updates?.updatedRange ?? "";
      const rangeMatch = updatedRange.match(/!(?:[A-Z]+)(\d+):[A-Z]+\d+$/);
      if (rangeMatch) {
        const rowNumber = Number(rangeMatch[1]);
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data: [
              // 列位置は上の newRow の並び(A〜I)に対応
              {
                range: `Messages!F${rowNumber}`,
                values: [[isRead ? "TRUE" : "FALSE"]],
              },
              { range: `Messages!H${rowNumber}`, values: [["FALSE"]] },
            ],
          },
        });
      }
    } catch (flagError) {
      console.warn(
        "is_read/delete_flag の boolean セル化に失敗しました(表示のみの問題):",
        flagError,
      );
    }

    // Auto-reopen: a member reply flips the thread status back to 未対応
    // (column J on the parent row) so a closed or in-progress case never
    // dies silently after the member writes again. Admin replies leave the
    // status untouched. Fail-soft: the reply itself is already saved, so a
    // status write failure only logs a warning.
    if (apiUser.role !== "admin" && parentSheetRow > 0) {
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "USER_ENTERED",
            data: [
              // J = status, K = last_status_updated_by. K is cleared because
              // this change is system-set (same convention as the automatic
              // 'open' tag at inquiry creation).
              {
                range: `Messages!J${parentSheetRow}:K${parentSheetRow}`,
                values: [["open", ""]],
              },
            ],
          },
        });
      } catch (statusError) {
        console.warn(
          "Failed to auto-reopen thread status after member reply:",
          statusError,
        );
      }
    }

    return NextResponse.json({ success: true, messageId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("返信送信APIエラー:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage || "返信の送信に失敗しました" },
      { status: 500 },
    );
  }
}
