import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/guards';
import { getSheetsClient } from "@/lib/sheets/googleapis";

import type { MessageStatus } from '@/types/message';

interface RequestBody {
  messageId: string;
  status: MessageStatus;
}

export async function PATCH(req: Request) {
  try {
    const apiUser = await getApiUser();
    if (!apiUser) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }

    if (apiUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
    }

    const updaterId: string = apiUser.memberId;

    const body = (await req.json()) as RequestBody;
    const { messageId, status } = body;

    // Writes accept the new values only; legacy strings exist just as
    // read-side aliases.
    const validStatuses: MessageStatus[] = ['open', 'in_progress', 'closed'];
    if (!messageId || !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: '無効なパラメータです' }, { status: 400 });
    }

    const { sheets, spreadsheetId } = getSheetsClient();



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

    // 更新処理: 更新者の member_id を確実に文字列型として保存（先頭に ' を付与）
    const updaterColumnLetter = String.fromCharCode(65 + updaterIdx);
    const stringUpdaterId = updaterId.startsWith("'") ? updaterId : `'${updaterId}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Messages!${updaterColumnLetter}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[stringUpdaterId]] },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}