import { normalizeId } from "./ids";

import "server-only";

import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";

const MAIN_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID?.trim() ?? "";

const RESPONSE_SPREADSHEET_ID =
  process.env.GOOGLE_FORM_RESPONSE_SPREADSHEET_ID?.trim() ?? "";

const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];

async function createSpreadsheetDoc(
  spreadsheetId: string,
  name: string,
): Promise<GoogleSpreadsheet> {
  if (!spreadsheetId) {
    throw new Error(`${name}が設定されていません。`);
  }

  const { client_email, private_key } = getServiceAccountCredentials();

  const auth = new JWT({
    email: client_email,
    key: private_key,
    scopes: SHEETS_SCOPE,
  });

  const doc = new GoogleSpreadsheet(spreadsheetId, auth);

  await doc.loadInfo();

  return doc;
}

type BatchGetValuesResponse = {
  valueRanges?: Array<{
    range?: string;
    values?: unknown[][];
  }>;
};

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function columnNumberToLetter(columnNumber: number): string {
  let result = "";
  let current = columnNumber;

  while (current > 0) {
    current -= 1;

    result = String.fromCharCode(65 + (current % 26)) + result;

    current = Math.floor(current / 26);
  }

  return result;
}

async function batchGetValues(
  spreadsheetId: string,
  ranges: string[],
): Promise<BatchGetValuesResponse> {
  if (ranges.length === 0) {
    return {
      valueRanges: [],
    };
  }

  const { client_email, private_key } = getServiceAccountCredentials();

  const auth = new JWT({
    email: client_email,
    key: private_key,
    scopes: SHEETS_SCOPE,
  });

  const params = new URLSearchParams();

  for (const range of ranges) {
    params.append("ranges", range);
  }

  params.set("majorDimension", "ROWS");

  const response = await auth.request<BatchGetValuesResponse>({
    url:
      `https://sheets.googleapis.com/v4/spreadsheets/` +
      `${encodeURIComponent(spreadsheetId)}/values:batchGet?` +
      params.toString(),
    method: "GET",
  });

  return response.data;
}

/**
 * 複数イベントのGoogleフォーム回答タブを
 * まとめて確認する。
 *
 * key   = event_id
 * value = 回答済みか
 */
export async function getEventResponseStatusMap({
  eventIds,
  memberId,
}: {
  eventIds: string[];
  memberId: string;
}): Promise<Map<string, boolean>> {
  const targetMemberId = normalizeId(memberId);

  const result = new Map<string, boolean>();

  for (const eventId of eventIds) {
    result.set(eventId, false);
  }

  if (!targetMemberId || eventIds.length === 0) {
    return result;
  }

  const [mainDoc, responseDoc] = await Promise.all([
    createSpreadsheetDoc(MAIN_SPREADSHEET_ID, "GOOGLE_SHEET_ID"),

    createSpreadsheetDoc(
      RESPONSE_SPREADSHEET_ID,
      "GOOGLE_FORM_RESPONSE_SPREADSHEET_ID",
    ),
  ]);

  const eventsSheet = mainDoc.sheetsByTitle["Events"];

  if (!eventsSheet) {
    throw new Error("Eventsシートが見つかりません。");
  }

  const eventIdSet = new Set(eventIds);

  const eventRows = await eventsSheet.getRows();

  const sheetNameByEventId = new Map<string, string>();

  for (const row of eventRows) {
    const eventId = String(row.get("event_id") ?? "").trim();

    if (!eventIdSet.has(eventId)) {
      continue;
    }

    let sheetName = String(row.get("response_sheet_name") ?? "").trim();

    /*
     * 名前が取れない場合だけ
     * response_sheet_idから探す。
     */
    if (!sheetName) {
      const sheetIdRaw = String(row.get("response_sheet_id") ?? "").trim();

      const sheetId = Number(sheetIdRaw);

      if (sheetIdRaw && Number.isFinite(sheetId)) {
        sheetName =
          responseDoc.sheetsByIndex.find((sheet) => sheet.sheetId === sheetId)
            ?.title ?? "";
      }
    }

    if (sheetName) {
      sheetNameByEventId.set(eventId, sheetName);
    }
  }

  /*
   * まず1行目だけまとめて取得し、
   * 各回答タブの「会員ID」が何列目か確認。
   */
  const headerEntries = Array.from(sheetNameByEventId.entries());

  const headerRanges = headerEntries.map(
    ([, sheetName]) => `${quoteSheetName(sheetName)}!1:1`,
  );

  const headerResponse = await batchGetValues(
    RESPONSE_SPREADSHEET_ID,
    headerRanges,
  );

  const memberColumnByEventId = new Map<string, number>();

  headerEntries.forEach(([eventId], index) => {
    const headers = (
      headerResponse.valueRanges?.[index]?.values?.[0] ?? []
    ).map((value) => String(value ?? "").trim());

    const memberIdIndex = headers.indexOf("会員ID");

    if (memberIdIndex >= 0) {
      /*
       * A列 = 1
       */
      memberColumnByEventId.set(eventId, memberIdIndex + 1);
    }
  });

  /*
   * 会員ID列だけをまとめて取得。
   */
  const responseEntries = Array.from(memberColumnByEventId.entries());

  const memberRanges = responseEntries.map(([eventId, column]) => {
    const sheetName = sheetNameByEventId.get(eventId)!;

    const columnLetter = columnNumberToLetter(column);

    return `${quoteSheetName(sheetName)}!` + `${columnLetter}2:${columnLetter}`;
  });

  const memberResponse = await batchGetValues(
    RESPONSE_SPREADSHEET_ID,
    memberRanges,
  );

  responseEntries.forEach(([eventId], index) => {
    const values = memberResponse.valueRanges?.[index]?.values ?? [];

    const answered = values.some(
      (row) => normalizeId(row[0]) === targetMemberId,
    );

    result.set(eventId, answered);
  });

  return result;
}
