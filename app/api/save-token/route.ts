import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/guards";
import { getSheetsClient } from "@/lib/sheets/googleapis";

interface SaveTokenRequestBody { token?: string;}
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

    const body = (await request.json()) as SaveTokenRequestBody;
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token is missing" },
        { status: 400 }
      );
    }

    const { sheets, spreadsheetId } = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Users!A1:Z",
    });

    const rows = (response.data.values || []) as string[][];
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Users sheet data is empty" },
        { status: 404 }
      );
    }

    const headers = rows[0].map((header) => String(header).toLowerCase().trim() );
    const memberIdIdx = headers.findIndex(
      (header) => header === "member_id" || header === "id" || header === "memberid"
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

    const rowIndex = rows.findIndex(
      (row, index) => index > 0 && String(row[memberIdIdx] ?? "").trim() === apiUser.memberId
    );
    if (rowIndex === -1) {
      return NextResponse.json(
        { success: false, error: "ログインユーザーがUsersシートに見つかりません" },
        { status: 404 }
      );
    }

    // const fcmTokenColumn = columnIndexToLetter(fcmTokenIdx);
    // const cellRange = `Users!${fcmTokenColumn}${rowIndex + 1}`;

    // // fcm_token のセルだけ更新する。
    // // 名前・role・status・updated_at 等の既存データには触れない。
    // await sheets.spreadsheets.values.update({
    //   spreadsheetId,
    //   range: cellRange,
    //   valueInputOption: "RAW",
    //   requestBody: { values: [[token]], },
    // });
    const fcmTokenColumn = columnIndexToLetter(fcmTokenIdx);
    const cellRange = `Users!${fcmTokenColumn}${rowIndex + 1}`;
    const duplicateTokenRows = rows .map((row, index) => ({ row, index })) .filter(
    ({ row, index }) =>
      index > 0 &&
      index !== rowIndex &&
      String(row[fcmTokenIdx] ?? "").trim() === token
  );

const updateData = [
  ...duplicateTokenRows.map(({ index }) => ({
    range: `Users!${fcmTokenColumn}${index + 1}`,
    values: [[""]],
  })),
  {
    range: cellRange,
    values: [[token]],
  },
];

await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: {
    valueInputOption: "RAW",
    data: updateData,
  },
});

    return NextResponse.json({
      success: true,
      message: "FCM token saved successfully",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("=== SAVE TOKEN ERROR ===", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}