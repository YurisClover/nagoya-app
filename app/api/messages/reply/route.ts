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

    if (!body) {
      return NextResponse.json(
        { success: false, error: '本文が不足しています' },
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

    // スプレッドシートからメッセージ一覧を取得（宛先の補正と件名の自動補完に使用）
    const messagesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A:H',
    });
    const rows = messagesRes.data.values || [];

    let resolvedRecipientId = recipientId;
    let finalTitle = title?.trim();

    if (rows.length > 1) {
      const headers = rows[0].map((h: string) => h.toLowerCase().replace(/[_-\s]/g, "").trim());
      let sIdIdx = headers.findIndex((h) => h === 'senderid' || h === 'sender');
      let rIdIdx = headers.findIndex((h) => h === 'recipientid' || h === 'recipient');
      let tIdx = headers.findIndex((h) => h === 'title' || h === 'subject');
      
      if (sIdIdx === -1) sIdIdx = 1;
      if (rIdIdx === -1) rIdIdx = 2;
      if (tIdx === -1) tIdx = 3;

      // ==========================================
      // 【安全策】recipientId が未指定、または自分自身（senderId）を指している場合、
      // 過去のメッセージ履歴から「やり取りしていた相手（管理者など）」のIDを逆引きして自動補完する
      // ==========================================
      if (!resolvedRecipientId || String(resolvedRecipientId).trim() === String(senderId).trim()) {
        for (let i = rows.length - 1; i >= 1; i--) {
          const row = rows[i];
          const s = row[sIdIdx]?.toString().trim();
          const r = row[rIdIdx]?.toString().trim();

          // 過去に自分宛てにメッセージを送ってきた相手、または自分が送った相手を探す
          if (r === senderId && s && s !== senderId) {
            resolvedRecipientId = s; // 相手から自分宛てに来ていたメッセージの送信者
            break;
          } else if (s === senderId && r && r !== senderId) {
            resolvedRecipientId = r; // 自分が過去に送った相手
            break;
          }
        }
      }

      // ★ 件名が指定されていない場合、相手との直近のやり取りを探して件名を自動補完する
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

    // 送信者と受信者が同じ（自分宛て）の場合は true、違う人宛て（他人宛て）の場合は false
    const isRead = String(senderId).trim() === String(resolvedRecipientId).trim() ? 'true' : 'false';

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A:H',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [messageId, senderId, resolvedRecipientId, finalTitle, body, isRead, createdAt, 'false'],
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