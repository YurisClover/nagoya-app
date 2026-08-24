import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

export async function POST() {
  try {
    const session = await auth();
    const currentMemberId = session?.user?.id || (session?.user as any)?.member_id;

    if (!session || !currentMemberId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
    }

    const googleAuth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: googleAuth });

    // Users シートを取得
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A1:Z',
    });

    const rows = res.data.values || [];
    if (rows.length === 0) return NextResponse.json({ success: true });

    // ヘッダーから列のインデックスを取得
    const headers = rows[0].map(h => String(h).toLowerCase().trim());
    const memberIdIdx = headers.findIndex(h => h === 'member_id' || h === 'id');
    const fcmTokenIdx = headers.findIndex(h => h === 'fcm_token');

    if (memberIdIdx === -1 || fcmTokenIdx === -1) {
      return NextResponse.json({ success: false, error: '必要な列が見つかりません' }, { status: 400 });
    }

    // ログイン中のユーザーの行番号を特定
    const rowIndex = rows.findIndex(row => String(row[memberIdIdx]).trim() === String(currentMemberId).trim());
    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // トークンのセル位置を特定 (例: A列が0なら、fcm_tokenがG列なら6 -> G)
    const columnLetter = String.fromCharCode(65 + fcmTokenIdx); 
    const cellRange = `Users!${columnLetter}${rowIndex + 1}`; // 行番号は1から始まるため +1

    // 該当のセルを空文字列で上書き
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['']] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('FCM Token削除エラー:', error);
    return NextResponse.json({ success: false, error: 'サーバーエラー' }, { status: 500 });
  }
}