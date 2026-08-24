import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/guards';
import crypto from 'crypto';
import { nowJST } from '@/lib/datetime'; // lib/datetime.ts をインポート
import { getSheetsClient } from "@/lib/sheets/googleapis";

interface RequestBody {
  parentMessageId?: string;
  recipientId?: string;
  subject?: string;
  body?: string;
}

export async function POST(req: Request) {
  try {
    const apiUser = await getApiUser();

    if (!apiUser) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    if (apiUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
    }

    const bodyData = (await req.json()) as RequestBody;
    const { parentMessageId, recipientId, subject, body } = bodyData;

    if (!parentMessageId || !recipientId || !body) {
      return NextResponse.json({ success: false, error: '必須パラメーターが不足しています' }, { status: 400 });
    }

    const myAdminId = apiUser.memberId;
    const { sheets, spreadsheetId } = getSheetsClient();




    const newMessageId = crypto.randomUUID();
    
    // ★ lib/datetime.ts の nowJST() を使用して生成
    const createdAt = nowJST();

    const cleanSubject = (subject || '').replace(/^Re:\s*/i, '').trim();
    const replyTitle = `Re: ${cleanSubject}`;

    // 行データ（A: message_id, B: sender_id, C: recipient_id, D: subject, E: body, F: is_read, G: created_at, H: delete_flag, I: parent_id）
    const newRow = [
      newMessageId,
      myAdminId,
      recipientId,
      replyTitle,
      body,
      'false',
      createdAt,
      'false',
      parentMessageId, // ★ I列に親メッセージの message_id を格納
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A1:I',
      valueInputOption: 'RAW',
      requestBody: {
        values: [newRow],
      },
    });

    return NextResponse.json({ success: true, messageId: newMessageId });
  } catch (error: unknown) {
    console.error('返信送信エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '送信エラー';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}