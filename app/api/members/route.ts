export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/guards';
import { getSheetsClient } from "@/lib/sheets/googleapis";

export type MemberOption = {
  member_id: string;
  user_name: string;
  role: string;
  status: string;
};

// メッセージの個人宛先ピッカー用に、会員一覧を返す。
// admin のみアクセス可能。氏名/会員IDでの絞り込みはクライアント側で行うため、
// ここでは active な会員をまとめて返すだけにする。
export async function GET(): Promise<NextResponse> {
  try {
    const apiUser = await getApiUser();

    if (!apiUser) {
      return NextResponse.json({ success: false, error: '認証されていません' }, { status: 401 });
    }
    if (apiUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
    }

    const { sheets, spreadsheetId } = getSheetsClient(true);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A1:Z',
    });

    const rows = (res.data.values || []) as unknown[][];
    if (rows.length <= 1) {
      return NextResponse.json({ success: true, members: [] });
    }

    const header = (rows[0] || []).map((h) => String(h).toLowerCase().trim());
    let idIdx = header.findIndex((h) => h === 'member_id' || h === 'id' || h === 'memberid');
    let nameIdx = header.findIndex((h) => h === 'user_name' || h === 'username' || h === 'name');
    const roleIdx = header.findIndex((h) => h === 'role');
    const statusIdx = header.findIndex((h) => h === 'status');

    if (idIdx === -1) idIdx = 0;
    if (nameIdx === -1) nameIdx = 1;

    const members: MemberOption[] = rows
      .slice(1)
      .map((row) => ({
        member_id: row[idIdx] != null ? String(row[idIdx]).trim() : '',
        user_name: row[nameIdx] != null ? String(row[nameIdx]).trim() : '',
        role: roleIdx !== -1 && row[roleIdx] != null ? String(row[roleIdx]).trim().toLowerCase() : '',
        status: statusIdx !== -1 && row[statusIdx] != null ? String(row[statusIdx]).trim().toLowerCase() : '',
      }))
      // 宛先候補は有効な会員のみ。自分自身(admin)は send-notification 側でも
      // 除外されるが、候補一覧としては残しておく(1対1で admin 同士も送れるように)。
      .filter((m) => m.member_id !== '' && (m.status === 'active' || m.status === '有効'));

    return NextResponse.json({ success: true, members });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('会員一覧取得エラー:', errorMessage);
    return NextResponse.json({ success: false, members: [], error: errorMessage }, { status: 500 });
  }
}
