// src/app/api/group-members/route.ts
import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/guards';
import { getSheetsClient } from "@/lib/sheets/googleapis";

export async function GET(req: Request) {
  try {
    // グループ所属の会員IDリストは個人情報。未ログイン/一般会員には返さない。
    const apiUser = await getApiUser();
    if (!apiUser) {
      return NextResponse.json({ success: false, memberIds: [], error: '認証されていません' }, { status: 401 });
    }
    if (apiUser.role !== 'admin') {
      return NextResponse.json({ success: false, memberIds: [], error: '権限がありません' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    // group_name または group_id を受け取る
    const groupName = searchParams.get('groupName');
    const groupIdParam = searchParams.get('groupId');

    const { sheets, spreadsheetId } = getSheetsClient(true);



    let targetGroupId = groupIdParam;

    // 【ステップ1】 group_name が渡された場合、Groupsシートから対応する group_id を検索
    if (groupName && !targetGroupId) {
      const groupsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Groups!A1:Z',
      });
      const groupRows = groupsRes.data.values || [];
      if (groupRows.length > 1) {
        const gHeader = groupRows[0].map((h) => String(h).trim().toLowerCase());
        const gIdIdx = gHeader.indexOf('group_id') !== -1 ? gHeader.indexOf('group_id') : 0;
        const gNameIdx = gHeader.indexOf('group_name') !== -1 ? gHeader.indexOf('group_name') : 1;

        // group_name が一致する行を探して group_id を取得
        const matchedRow = groupRows.slice(1).find((row) => {
          const name = row[gNameIdx] ? String(row[gNameIdx]).trim() : '';
          return name === groupName.trim();
        });

        if (matchedRow) {
          targetGroupId = String(matchedRow[gIdIdx]).trim();
        }
      }
    }

    // targetGroupId が見つからない・指定がない場合は空配列を返す（誤送信防止）
    if (!targetGroupId) {
      return NextResponse.json({ success: true, memberIds: [] });
    }

    // 【ステップ2】 GroupMembers シートを参照し、一致する group_id の member_id を全て抽出
    const membersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'GroupMembers!A1:Z',
    });
    const memberRows = membersRes.data.values || [];

    if (memberRows.length < 2) {
      return NextResponse.json({ success: true, memberIds: [] });
    }

    const mHeader = memberRows[0].map((h) => String(h).trim().toLowerCase());
    const mGroupIdIdx = mHeader.indexOf('group_id') !== -1 ? mHeader.indexOf('group_id') : 0;
    const mMemberIdIdx = mHeader.indexOf('member_id') !== -1 ? mHeader.indexOf('member_id') : 1;

    // Groupsシートの group_id と同じ値を持つ member_id のみフィルタリング
    const memberIds = memberRows
      .slice(1)
      .filter((row) => {
        const rowGroupId = row[mGroupIdIdx] ? String(row[mGroupIdIdx]).trim() : '';
        return rowGroupId === targetGroupId;
      })
      .map((row) => (row[mMemberIdIdx] ? String(row[mMemberIdIdx]).trim() : ''))
      .filter((id) => id !== '');

    return NextResponse.json({ success: true, memberIds, groupId: targetGroupId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('グループメンバー取得エラー:', errorMessage);
    return NextResponse.json({ success: false, memberIds: [], error: errorMessage }, { status: 500 });
  }
}