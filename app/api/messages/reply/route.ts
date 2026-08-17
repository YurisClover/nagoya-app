import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import crypto from 'crypto';

// 1. NextAuthセッション用の型を定義
type SessionUser = {
  member_id?: string;
  id?: string;
  name?: string | null;
  email?: string | null;
};

// 2. リクエストボディの型を定義
interface ReplyRequestBody {
  parentMessageId?: string;
  recipientId?: string;
  title?: string;
  body?: string;
  senderId?: string;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    // 3. (session?.user as any) をカスタム型に置き換え
    const user = session?.user as SessionUser | undefined;
    const currentMemberId = user?.member_id || user?.id;

    if (!session || !currentMemberId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 4. req.json() を型付け
    const bodyData = (await req.json()) as ReplyRequestBody;
    const { parentMessageId, recipientId, title, body, senderId: inputSenderId } = bodyData;

    if (!body) {
      return NextResponse.json(
        { success: false, error: '本文が不足しています' },
        { status: 400 }
      );
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: '環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const googleAuth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: googleAuth });

    const messageId = crypto.randomUUID();
    const now = new Date();
    const createdAt = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const senderId = inputSenderId || currentMemberId;

    // メッセージ一覧を取得して親メッセージ情報から宛先・件名を特定
    const messagesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A:I',
    });
    
    // 5. APIの戻り値を string[][] 型として明示
    const rows = (messagesRes.data.values as string[][]) || [];

    let resolvedRecipientId = recipientId;
    let finalTitle = title?.trim();
    let resolvedParentId = parentMessageId || '';

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

      // 親メッセージの判定
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

      // 宛先補正フォールバック
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

      // 件名補正フォールバック
      if (!finalTitle && resolvedRecipientId) {
        for (let i = rows.length - 1; i >= 1; i--) {
          const row = rows[i];
          const s = row[sIdIdx]?.toString().trim();
          const r = row[rIdIdx]?.toString().trim();
          const t = row[tIdx]?.toString().trim();

          if (
            ((s === senderId && r === resolvedRecipientId) || (s === resolvedRecipientId && r === senderId)) &&
            t
          ) {
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

    if (!finalTitle) {
      finalTitle = '（件名なし）';
    }

    const isRead = String(senderId).trim() === String(resolvedRecipientId).trim() ? 'true' : 'false';

    // ⭕ スプレッドシートのA〜I列に完全に合わせた配列構造
    const newRow = [
      messageId,           // A列: message_id
      String(senderId),    // B列: sender_id
      resolvedRecipientId, // C列: recipient_id
      finalTitle,          // D列: subject
      body,                // E列: body
      isRead,              // F列: is_read ('true' / 'false')
      createdAt,           // G列: created_at
      'false',             // H列: delete_flag ('false')
      resolvedParentId,    // I列: parent_id
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A1:I',
      valueInputOption: 'RAW',
      requestBody: {
        values: [newRow],
      },
    });

    return NextResponse.json({ success: true, messageId });
    
  } catch (error: unknown) { // 6. catch句のエラーを unknown 型に変更し、安全に判定
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('返信送信APIエラー:', errorMessage);
    
    return NextResponse.json(
      { success: false, error: errorMessage || '返信の送信に失敗しました' },
      { status: 500 }
    );
  }
}