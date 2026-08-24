import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/guards';
import crypto from 'crypto';
import { nowJST } from '@/lib/datetime';
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
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bodyData = (await req.json()) as ReplyRequestBody;
    const { parentMessageId, recipientId, title, body } = bodyData;

    if (!body) {
      return NextResponse.json(
        { success: false, error: '本文が不足しています' },
        { status: 400 }
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
      range: 'Messages!A:I',
    });
    
    const rows = (messagesRes.data.values as string[][]) || [];

    let resolvedRecipientId = recipientId;
    let finalTitle = title?.trim();
    const resolvedParentId = parentMessageId || '';

    if (rows.length > 1) {
      const headers = (rows[0] || []).map((h) => h.toLowerCase().replace(/[_-\s]/g, "").trim());
      let mIdIdx = headers.findIndex((h) => h === 'messageid' || h === 'id');
      let sIdIdx = headers.findIndex((h) => h === 'senderid' || h === 'sender');
      let rIdIdx = headers.findIndex((h) => h === 'recipientid' || h === 'recipient');
      let tIdx = headers.findIndex((h) => h === 'title' || h === 'subject');

      if (mIdIdx === -1) mIdIdx = 0;
      if (sIdIdx === -1) sIdIdx = 1;
      if (rIdIdx === -1) rIdIdx = 2;
      if (tIdx === -1) tIdx = 3;

      if (resolvedParentId) {
        const parentRow = rows.find((r) => r[mIdIdx]?.toString().trim() === resolvedParentId);
        if (parentRow) {
          const pSender = parentRow[sIdIdx]?.toString().trim();
          const pRecipient = parentRow[rIdIdx]?.toString().trim();
          const pTitle = parentRow[tIdx]?.toString().trim();

          if (!resolvedRecipientId || resolvedRecipientId === senderId) {
            resolvedRecipientId = pSender === senderId ? pRecipient : pSender;
          }
          if (!finalTitle && pTitle) {
            const cleanT = pTitle.replace(/^Re:\s*/i, '');
            finalTitle = `Re: ${cleanT}`;
          }
        }
      }

      if (!resolvedRecipientId || String(resolvedRecipientId).trim() === String(senderId).trim()) {
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
          if (((s === senderId && r === resolvedRecipientId) || (s === resolvedRecipientId && r === senderId)) && t) {
            const cleanT = t.replace(/^Re:\s*/i, '');
            finalTitle = `Re: ${cleanT}`;
            break;
          }
        }
      }
    }

    if (!resolvedRecipientId || String(resolvedRecipientId).trim() === String(senderId).trim()) {
      return NextResponse.json(
        { success: false, error: '送信先が正しく特定できません' },
        { status: 400 }
      );
    }

    if (!finalTitle) finalTitle = '（件名なし）';

    const isRead = String(senderId).trim() === String(resolvedRecipientId).trim() ? 'true' : 'false';

    const newRow = [
      messageId,
      String(senderId),
      resolvedRecipientId,
      finalTitle,
      body,
      isRead,
      createdAt,
      'false',
      resolvedParentId,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A1:I',
      valueInputOption: 'RAW',
      requestBody: { values: [newRow] },
    });

    return NextResponse.json({ success: true, messageId });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('返信送信APIエラー:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage || '返信の送信に失敗しました' },
      { status: 500 }
    );
  }
}