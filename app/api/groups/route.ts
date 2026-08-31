import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guards";
import { getSheetsClient } from "@/lib/sheets/googleapis";

export async function GET() {
  try {
    // グループ一覧は admin のメッセージ送信画面でのみ使う。未ログインや
    // 一般会員に組織構成を返さないよう、必ず admin で遮断する。
    const apiUser = await getApiUser();
    if (!apiUser) {
      return NextResponse.json(
        { success: false, groups: [], error: "認証されていません" },
        { status: 401 },
      );
    }
    if (apiUser.role !== "admin") {
      return NextResponse.json(
        { success: false, groups: [], error: "権限がありません" },
        { status: 403 },
      );
    }

    const { sheets, spreadsheetId } = getSheetsClient(true);

    // Groupsシートから取得
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Groups!A1:Z",
    });

    const rows = res.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ success: true, groups: [] });
    }

    // ヘッダー行を解析（大文字小文字を無視）
    const header = rows[0].map((h) => String(h).trim().toLowerCase());
    let groupIdIdx = header.indexOf("group_id");
    let groupNameIdx = header.indexOf("group_name");

    // ヘッダー名で見つからない場合のデフォルト（A列: ID, B列: グループ名）
    if (groupIdIdx === -1) groupIdIdx = 0;
    if (groupNameIdx === -1) groupNameIdx = 1;

    const groups = rows
      .slice(1)
      .map((row) => {
        const id = row[groupIdIdx] ? String(row[groupIdIdx]).trim() : "";
        const name = row[groupNameIdx] ? String(row[groupNameIdx]).trim() : "";
        return {
          // 画面側がどの名前で参照していても動くよう両方持たせる
          group_id: id,
          group_name: name,
          id: id,
          name: name,
        };
      })
      .filter((g) => g.id !== "" || g.name !== "");

    return NextResponse.json({ success: true, groups });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("グループ一覧取得エラー:", errorMessage);
    return NextResponse.json(
      { success: false, groups: [], error: errorMessage },
      { status: 500 },
    );
  }
}
