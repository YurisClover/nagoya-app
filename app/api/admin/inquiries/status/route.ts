import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import { Session } from 'next-auth';

type MessageStatus = 'unsupported' | 'pending' | 'closed';

interface SessionUser {
  member_id?: string;
  id?: string;
  name?: string | null;
  email?: string | null;
}

interface RequestBody {
  messageId: string;
  status: MessageStatus;
}

export async function PATCH(req: Request) {
  try {
    const session: Session | null = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    // ★変更: ログイン中のユーザーの member_id を取得
    const user = session.user as SessionUser | undefined;
    const updaterId: string = user?.member_id || user?.id || '管理者';

    const body = (await req.json()) as RequestBody;
    const { messageId, status } = body;

    const validStatuses: MessageStatus[] = ['unsupported', 'pending', 'closed'];
    if (!messageId || !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: '無効なパラメータです' }, { status: 400 });
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json({ success: false, error: '環境変数が設定されていません' }, { status: 500 });
    }

    const authClient = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Messages!A1:Z',
    });

    const rows: string[][] = (res.data.values as string[][]) || [];
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'メッセージが見つかりません' }, { status: 404 });
    }

    const header = (rows[0] || []).map((h: string) => h.toLowerCase().trim());
    
    // ID列の探索
    let idIdx = header.findIndex((h) => h === 'message_id' || h === 'id' || h === 'messageid');
    if (idIdx === -1) idIdx = 0; // デフォルトA列

    // ステータス列（J列=9）
    const statusIdx = 9;
    // 更新者列（K列=10）
    const updaterIdx = 10;

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const rowId = rows[i]?.[idIdx]?.trim() ?? '';
      if (rowId === messageId) {
        rowIndex = i + 1; // 1-indexed for sheets
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: '対象のメッセージが見つかりません' }, { status: 404 });
    }

    // 更新処理: ステータス
    const statusColumnLetter = String.fromCharCode(65 + statusIdx);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Messages!${statusColumnLetter}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[status]] },
    });

    // 更新処理: 更新者の member_id を保存
    const updaterColumnLetter = String.fromCharCode(65 + updaterIdx);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Messages!${updaterColumnLetter}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[updaterId]] },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}