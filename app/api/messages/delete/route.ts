// src/app/api/messages/delete/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    // ★ 修正: replyIds も受け取れるように取得
    const { messageId, replyIds } = await request.json();
    if (!messageId) {
      return NextResponse.json({ success: false, error: 'messageId が指定されていません' }, { status: 400 });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
    }

    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 1. Messagesシートの全データを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A:H',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Messagesシートにデータがありません' }, { status: 404 });
    }

    const headers = rows[0].map((h: string) => h.toLowerCase().trim());
    let idIdx = headers.findIndex((h) => h === 'message_id' || h === 'id');
    let deleteFlagIdx = headers.findIndex((h) => h === 'delete_flag');

    if (idIdx === -1) idIdx = 0; // A列
    if (deleteFlagIdx === -1) deleteFlagIdx = 7; // H列 (index 7)

    const colLetter = String.fromCharCode(65 + deleteFlagIdx);

    // ★ 修正: 削除対象となるすべてのID（親メッセージID + 返信ID一覧）のSetを作成
    const targetIds = new Set<string>([
      messageId,
      ...(Array.isArray(replyIds) ? replyIds : []),
    ]);

    // ★ 修正: 対象となる全ての行を探して更新リクエスト（Promise）を作成
    const updatePromises: Promise<any>[] = [];

    for (let i = 1; i < rows.length; i++) {
      const currentId = rows[i][idIdx]?.toString().trim();
      if (currentId && targetIds.has(currentId)) {
        const rowIndex = i + 1; // スプレッドシートは1始まり
        
        updatePromises.push(
          sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Messages!${colLetter}${rowIndex}`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [['true']],
            },
          })
        );
      }
    }

    if (updatePromises.length === 0) {
      return NextResponse.json({ success: false, error: '該当メッセージが見つかりませんでした' }, { status: 404 });
    }

    // ★ 並列ですべての該当行（親＋子）の delete_flag を更新
    await Promise.all(updatePromises);

    return NextResponse.json({ 
      success: true, 
      message: 'メッセージおよびスレッド内の返信を削除しました',
      deletedCount: updatePromises.length 
    });
  } catch (error: any) {
    console.error('Delete Message Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}