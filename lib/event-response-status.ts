import "server-only";

import {
  GoogleSpreadsheet,
} from "google-spreadsheet";

import {
  JWT,
} from "google-auth-library";

import {
  getServiceAccountCredentials,
} from "@/lib/google-auth";


const MAIN_SPREADSHEET_ID =
  process.env.GOOGLE_SHEET_ID
    ?.trim() ?? "";


const RESPONSE_SPREADSHEET_ID =
  process.env
    .GOOGLE_FORM_RESPONSE_SPREADSHEET_ID
    ?.trim() ?? "";


const SHEETS_SCOPE = [
  "https://www.googleapis.com/auth/spreadsheets",
];


function normalizeMemberId(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .replace(/\.0+$/, "");
}


async function createSpreadsheetDoc(
  spreadsheetId: string,
  name: string,
): Promise<GoogleSpreadsheet> {
  if (!spreadsheetId) {
    throw new Error(
      `${name}が設定されていません。`,
    );
  }


  const {
    client_email,
    private_key,
  } =
    getServiceAccountCredentials();


  const auth =
    new JWT({
      email: client_email,
      key: private_key,
      scopes: SHEETS_SCOPE,
    });


  const doc =
    new GoogleSpreadsheet(
      spreadsheetId,
      auth,
    );


  await doc.loadInfo();


  return doc;
}


/**
 * Googleフォームの回答タブを直接確認し、
 * 指定会員が回答済みか判定する。
 *
 * answerシートへの同期は待たない。
 */
export async function hasSubmittedEventResponse({
  eventId,
  memberId,
}: {
  eventId: string;
  memberId: string;
}): Promise<boolean> {
  const normalizedEventId =
    eventId.trim();


  const normalizedMemberId =
    normalizeMemberId(
      memberId,
    );


  if (!normalizedEventId) {
    throw new Error(
      "イベントIDが指定されていません。",
    );
  }


  if (!normalizedMemberId) {
    throw new Error(
      "会員IDが指定されていません。",
    );
  }


  const [
    mainDoc,
    responseDoc,
  ] =
    await Promise.all([
      createSpreadsheetDoc(
        MAIN_SPREADSHEET_ID,
        "GOOGLE_SHEET_ID",
      ),

      createSpreadsheetDoc(
        RESPONSE_SPREADSHEET_ID,
        "GOOGLE_FORM_RESPONSE_SPREADSHEET_ID",
      ),
    ]);


  const eventsSheet =
    mainDoc.sheetsByTitle[
      "Events"
    ];


  if (!eventsSheet) {
    throw new Error(
      "Eventsシートが見つかりません。",
    );
  }


  const eventRows =
    await eventsSheet.getRows();


  const eventRow =
    eventRows.find(
      (row) =>
        String(
          row.get(
            "event_id",
          ) ?? "",
        ).trim() ===
        normalizedEventId,
    );


  if (!eventRow) {
    throw new Error(
      "イベントが見つかりません。",
    );
  }


  const responseSheetName =
    String(
      eventRow.get(
        "response_sheet_name",
      ) ?? "",
    ).trim();


  const responseSheetIdRaw =
    String(
      eventRow.get(
        "response_sheet_id",
      ) ?? "",
    ).trim();


  const responseSheetId =
    Number(
      responseSheetIdRaw,
    );


  const responseSheet =
    Number.isFinite(
      responseSheetId,
    ) &&
    responseSheetIdRaw
      ? responseDoc.sheetsByIndex.find(
          (sheet) =>
            sheet.sheetId ===
            responseSheetId,
        )
      : responseSheetName
        ? responseDoc.sheetsByTitle[
            responseSheetName
          ]
        : undefined;


  if (!responseSheet) {
    throw new Error(
      "イベントの回答タブが見つかりません。",
    );
  }


  await responseSheet.loadHeaderRow();


  const headers =
    responseSheet.headerValues ?? [];


  if (
    !headers.includes(
      "会員ID",
    )
  ) {
    throw new Error(
      `${responseSheet.title}に会員ID列がありません。`,
    );
  }


  const rows =
    await responseSheet.getRows();


  return rows.some(
    (row) =>
      normalizeMemberId(
        row.get(
          "会員ID",
        ),
      ) ===
      normalizedMemberId,
  );
}