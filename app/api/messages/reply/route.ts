import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const currentMemberId = (session?.user as any)?.member_id || session?.user?.id;

    if (!session || !currentMemberId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { recipientId, title, body, senderId: inputSenderId } = await req.json();

    if (!recipientId || !body) {
      return NextResponse.json(
        { success: false, error: '送信先または本文が不足しています' },
        { status: 400 }
      );
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

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
    const createdAt = new Date().toISOString();
    const senderId = inputSenderId || currentMemberId;

    // ★ 件名が指定されていない場合、スプレッドシートから相手との直近のやり取りを探して件名を自動補完する
    let finalTitle = title?.trim();
    if (!finalTitle) {
      const messagesRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Messages!A:H',
      });
      const rows = messagesRes.data.values || [];
      if (rows.length > 1) {
        const headers = rows[0].map((h: string) => h.toLowerCase().replace(/[_-\s]/g, "").trim());
        let sIdIdx = headers.findIndex((h) => h === 'senderid' || h === 'sender');
        let rIdIdx = headers.findIndex((h) => h === 'recipientid' || h === 'recipient');
        let tIdx = headers.findIndex((h) => h === 'title' || h === 'subject');
        
        if (sIdIdx === -1) sIdIdx = 1;
        if (rIdIdx === -1) rIdIdx = 2;
        if (tIdx === -1) tIdx = 3;

        // ログインユーザーと recipientId の間でやり取りされているメッセージを新しい順に検索
        for (let i = rows.length - 1; i >= 1; i--) {
          const row = rows[i];
          const s = row[sIdIdx]?.toString().trim();
          const r = row[rIdIdx]?.toString().trim();
          const t = row[tIdx]?.toString().trim();

          if (
            ((s === senderId && r === recipientId) || (s === recipientId && r === senderId)) &&
            t
          ) {
            // すでに "Re: " がついている場合はそのまま、ついていなければ "Re: " を付与
            const cleanT = t.replace(/^Re:\s*/i, '');
            finalTitle = `Re: ${cleanT}`;
            break;
          }
        }
      }
    }

    if (!finalTitle) {
      finalTitle = '（件名なし）';
    }

    const isRead = String(senderId).trim() === String(currentMemberId).trim() ? 'true' : 'false';

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A:H',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [messageId, senderId, recipientId, finalTitle, body, isRead, createdAt, 'false'],
        ],
      },
    });

    return NextResponse.json({ success: true, messageId });
  } catch (error: any) {
    console.error('返信送信APIエラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '返信の送信に失敗しました' },
      { status: 500 }
    );
  }
}