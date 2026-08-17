import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth'; 

// 1. リクエストボディの型を定義
interface NotificationRequestBody {
  token?: string;
  email?: string;
}

// 2. Googleサービスアカウント情報の型を定義
interface GoogleCredentials {
  client_email?: string;
  private_key?: string;
  [key: string]: string | undefined; // 他のプロパティが含まれる場合への安全な対応
}

export async function POST(request: Request) {
  try {
    // 3. request.json() に型を適用
    const body = (await request.json()) as NotificationRequestBody;
    const { token, email: clientEmail } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is missing' }, { status: 400 });
    }

    const session = await auth();
    const userEmail = session?.user?.email || clientEmail;

    if (!userEmail) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Email not found' }, { status: 401 });
    }

    const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!base64Key) {
      return NextResponse.json({ success: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is missing' }, { status: 500 });
    }

    // Base64デコードしてJSONオブジェクトに変換し、型を適用
    const decodedJson = Buffer.from(base64Key.trim(), 'base64').toString('utf8');
    const credentials = JSON.parse(decodedJson) as GoogleCredentials;

    if (!credentials.client_email || !credentials.private_key) {
      return NextResponse.json({ success: false, error: 'Invalid service account JSON structure' }, { status: 500 });
    }

    const authGoogle = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authGoogle });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Users シートから全データを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:K',
    });

    // 4. APIの戻り値を string[][] 型として明示
    const rows = (response.data.values as string[][]) || [];
    
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Users sheet data is empty' }, { status: 404 });
    }

    // ユーザー検索 (D列: index 3)
    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length > 3 && row[3] === userEmail) {
        targetRowIndex = i + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return NextResponse.json({ success: false, error: `User email (${userEmail}) not found in Users sheet` }, { status: 404 });
    }

    const currentRow = [...rows[targetRowIndex - 1]];
    while (currentRow.length < 11) {
      currentRow.push('');
    }

    currentRow[7] = token;                    // H列: fcm_token
    currentRow[9] = new Date().toISOString(); // J列: updated_at

    // Users シートへ書き戻し
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Users!A${targetRowIndex}:K${targetRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [currentRow],
      },
    });

    return NextResponse.json({ success: true, message: 'FCM token saved successfully' });

  } catch (error: unknown) { // 5. catch句のエラーを unknown 型に変更し、安全に判定
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('=== SAVE TOKEN ERROR ===', errorMessage);
    
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}