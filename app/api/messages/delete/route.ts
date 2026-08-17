import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

// 1. リクエストボディの型を定義
interface DeleteRequestBody {
  messageId?: string;
  replyIds?: string[];
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    // 2. request.json() に型を適用
    const bodyData = (await request.json()) as DeleteRequestBody;
    const { messageId, replyIds } = bodyData;
    
    if (!messageId) {
      return NextResponse.json({ success: false, error: 'messageId が指定されていません' }, { status: 400 });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
    }

    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Messagesシートの全データを取得（A:I列）
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A:I',
    });

    // 3. APIの戻り値を string[][] 型として明示
    const rows = (response.data.values as string[][]) || [];
    
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Messagesシートにデータがありません' }, { status: 404 });
    }

    const headers = (rows[0] || []).map((h) => h.toLowerCase().trim());
    let idIdx = headers.findIndex((h) => h === 'message_id' || h === 'id' || h === 'messageid');
    let deleteFlagIdx = headers.findIndex((h) => h === 'delete_flag' || h === 'deleteflag');
    let parentIdIdx = headers.findIndex((h) => h === 'parent_id' || h === 'parentid' || h === 'parent');

    if (idIdx === -1) idIdx = 0; // A列
    if (deleteFlagIdx === -1) deleteFlagIdx = 7; // H列 (index 7)
    if (parentIdIdx === -1) parentIdIdx = 8; // I列 (index 8)

    const colLetter = String.fromCharCode(65 + deleteFlagIdx);

    // 削除対象のIDセット初期化（明示的に指定されたID群）
    const targetIds = new Set<string>([
      messageId,
      ...(Array.isArray(replyIds) ? replyIds : []),
    ]);

    // ★ スプレッドシート内を走査し、削除対象のメッセージを親（parent_id）に持つ子メッセージも自動で巻き込む
    let added = true;
    while (added) {
      added = false;
      for (let i = 1; i < rows.length; i++) {
        const currentId = rows[i][idIdx]?.toString().trim();
        const parentId = rows[i][parentIdIdx]?.toString().trim();

        if (currentId && parentId && targetIds.has(parentId) && !targetIds.has(currentId)) {
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
        const rowIndex = i + 1; // スプレッドシートの行番号（1始まり）
        
        // H列（delete_flag）を 'true' に更新
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

    await Promise.all(updatePromises);

    return NextResponse.json({ 
      success: true, 
      message: 'メッセージおよびスレッド内の返信をすべて削除しました',
      deletedCount: updatePromises.length 
    });
    
  } catch (error: unknown) { // 5. catch句のエラーを unknown 型に変更し、安全に判定
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Delete Message Error:', errorMessage);
    
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}