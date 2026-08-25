import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/guards';
import { getSheetsClient } from "@/lib/sheets/googleapis";

interface RequestBody {
  messageId?: string;
  replyIds?: string[];
}

interface SheetUpdateItem {
  range: string;
  values: string[][];
}

// 既読化: 指定された message_id / reply_id の is_read を true にする。
// admin 専用の処理ではないため /api/admin ではなく messages 配下に置く。
export async function POST(req: Request) {
  try {
    const apiUser = await getApiUser();
    if (!apiUser) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    const { memberId, role } = apiUser;

    const bodyData = (await req.json()) as RequestBody;
    const { messageId, replyIds = [] } = bodyData;
    const targetIds = new Set([messageId, ...replyIds].filter((id): id is string => Boolean(id)));

    if (targetIds.size === 0) {
      return NextResponse.json({ success: true });
    }

    const { sheets, spreadsheetId } = getSheetsClient();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A1:Z',
    });

    const rows = (res.data.values || []) as unknown[][];
    if (rows.length <= 1) return NextResponse.json({ success: true });

    const header = (rows[0] || []).map((h: unknown) => String(h).toLowerCase().trim());
    let idIdx = header.findIndex((h) => h === 'message_id' || h === 'id' || h === 'messageid');
    let isReadIdx = header.findIndex((h) => h === 'is_read' || h === 'isread' || h === 'read');

    let senderIdx = header.findIndex((h) => h === 'sender_id' || h === 'senderid' || h === 'sender');
    let recipientIdx = header.findIndex((h) => h === 'recipient_id' || h === 'recipientid' || h === 'recipient');

    if (idIdx === -1) idIdx = 0;
    if (isReadIdx === -1) isReadIdx = 5; // F列
    if (senderIdx === -1) senderIdx = 1;
    if (recipientIdx === -1) recipientIdx = 2;

    const updateData: SheetUpdateItem[] = [];
    rows.forEach((row, index) => {
      if (index === 0) return;
      const mId = row[idIdx]?.toString().trim();
      if (mId && targetIds.has(mId)) {
        // 所有チェック: 自分が当事者(送信者/受信者)の行のみ既読化できる。
        // 事務局宛て(recipient='admin')の行は admin のみ。
        const rowSender = row[senderIdx]?.toString().trim() ?? '';
        const rowRecipient = row[recipientIdx]?.toString().trim() ?? '';
        const involved =
          rowSender === memberId ||
          rowRecipient === memberId ||
          (rowRecipient.toLowerCase() === 'admin' && role === 'admin');
        if (!involved) return;
        const rowIndex = index + 1;
        const colLetter = String.fromCharCode(65 + isReadIdx);
        updateData.push({
          range: `Messages!${colLetter}${rowIndex}`,
          // USER_ENTERED + 'TRUE' = UI で TRUE と入力したのと同じ → boolean セルになる。
          // (RAW は boolean を渡しても文字列化され 'TRUE 表示になるため使わない)
          values: [['TRUE']],
        });
      }
    });

    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateData,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('既読更新エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '既読更新エラー';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
