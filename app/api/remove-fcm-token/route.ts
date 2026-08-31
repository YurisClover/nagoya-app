import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guards";
import { getSheetsClient } from "@/lib/sheets/googleapis";

interface RemoveTokenRequestBody { token?: string;}

function columnIndexToLetter(index: number): string {
  let n = index + 1;
  let result = "";

  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const apiUser = await getApiUser();

    if (!apiUser) {
      return NextResponse.json(
        { success: false, error: "認証されていません" },
        { status: 401 }
      );
    }
    let token = "";
    try {
      const body = (await request.json()) as RemoveTokenRequestBody;
      token = body.token?.trim() ?? "";
    } catch {
      // bodyなしでも処理は継続
    }

    const { sheets, spreadsheetId } = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Users!A1:Z",
    });
    const rows = (response.data.values || []) as string[][];
    if (rows.length === 0) {
      return NextResponse.json({ success: true });
    }
    const headers = rows[0].map((header) => String(header).toLowerCase().trim() );
    const memberIdIdx = headers.findIndex( (header) =>
        header === "member_id" ||
        header === "id" ||
        header === "memberid"
    );

    const fcmTokenIdx = headers.findIndex( (header) => header === "fcm_token" );

    if (memberIdIdx === -1 || fcmTokenIdx === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Usersシートに member_id または fcm_token 列が見つかりません",
        },
        { status: 400 }
      );
    }

    const rowIndex = rows.findIndex( (row, index) => index > 0 && String(row[memberIdIdx] ?? "").trim() === apiUser.memberId);

    if (rowIndex === -1) {
      return NextResponse.json(
        { success: false, error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    const storedToken = String(rows[rowIndex][fcmTokenIdx] ?? "").trim();

    // 別端末の新しいトークンに置き換わっている場合は消さない
    if (token && storedToken && token !== storedToken) {
      console.log( "FCMトークン削除をスキップ: Usersシートには別端末のトークンが保存されています" );
      return NextResponse.json({
        success: true,
        skipped: true,
      });
    }

    const fcmTokenColumn = columnIndexToLetter(fcmTokenIdx);
    const cellRange = `Users!${fcmTokenColumn}${rowIndex + 1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: "RAW",
      requestBody: { values: [[""]], },
    });

    return NextResponse.json({ success: true, });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("FCM Token削除エラー:", errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}