import "server-only";

import {GoogleSpreadsheet,type GoogleSpreadsheetWorksheet,} from "google-spreadsheet";
import {JWT,} from "google-auth-library";
import {getServiceAccountCredentials,} from "@/lib/google-auth";
import {APPLY_TOKEN_HEADER,validateEventResponseToken,} from "@/lib/event-response-validation";

const MAIN_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID ?.trim() ?? "";
const RESPONSE_SPREADSHEET_ID = process.env.GOOGLE_FORM_RESPONSE_SPREADSHEET_ID?.trim() ?? "";
const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets",];
const RESULT_HEADER = "判定結果";
const MEMBER_ID_RESULT_HEADER = "判定済み会員ID";
const ERROR_HEADER = "判定エラー";
const VALIDATED_AT_HEADER = "判定日時";
// const REQUIRED_HEADERS = [
//   APPLY_TOKEN_HEADER,
//   RESULT_HEADER,
//   MEMBER_ID_RESULT_HEADER,
//   ERROR_HEADER,
//   VALIDATED_AT_HEADER,
// ];

const APPLY_TOKEN_HEADERS = [
  APPLY_TOKEN_HEADER,
  "申込確認コード",
] as const;

const REQUIRED_RESULT_HEADERS = [
  RESULT_HEADER,
  MEMBER_ID_RESULT_HEADER,
  ERROR_HEADER,
  VALIDATED_AT_HEADER,
];

export type EventResponseSyncResult = {
  processed: number;
  valid: number;
  invalid: number;
  skipped: number;
  sheets: Array<{
    sheetName: string;
    eventId: string;
    processed: number;
    valid: number;
    invalid: number;
    skipped: number;
  }>;
};

function normalizeMemberId(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .replace(/\.0+$/, "");
}

function parseBoolean( value: unknown,): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return [
    "true",
    "1",
    "yes",
  ].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

function getEventIdFromSheetName(
  sheetName: string,
): string | null {
  /*
   * 対応するタブ名：
   * 回答_3
   * 回答_3_夏季交流会
   */
  const match =
    sheetName.match(
      /^回答_([^_]+)(?:_|$)/,
    );

  return match?.[1]?.trim() ||
    null;
}

function formatValidatedAt(
  date: Date,
): string {
  const parts =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      },
    ).formatToParts(date);

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ],
      ),
    );

  return [
    `${values.year}-${values.month}-${values.day}`,
    `${values.hour}:${values.minute}:${values.second}`,
  ].join(" ");
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

async function loadActiveMemberIds():
Promise<Set<string>> {
  const doc =
    await createSpreadsheetDoc(
      MAIN_SPREADSHEET_ID,
      "GOOGLE_SHEET_ID",
    );

  const usersSheet =
    doc.sheetsByTitle[
      "Users"
    ];

  if (!usersSheet) {
    throw new Error(
      "Usersシートが見つかりません。",
    );
  }

  const rows =
    await usersSheet.getRows();

  const headers =
    usersSheet.headerValues ?? [];

  const memberIdHeader = [
    "id",
    "member_id",
    "会員ID",
  ].find((header) =>
    headers.includes(header),
  );

  if (!memberIdHeader) {
    throw new Error(
      `Usersシートに会員ID列がありません。現在の列：${headers.join(
        "、",
      )}`,
    );
  }

  const memberIds =
    rows
      .filter(
        (row) =>
          !parseBoolean(
            row.get(
              "is_deleted",
            ),
          ),
      )
      .map(
        (row) =>
          normalizeMemberId(
            row.get(
              memberIdHeader,
            ),
          ),
      )
      .filter(Boolean);

  if (memberIds.length === 0) {
    throw new Error(
      `Usersシートの${memberIdHeader}列に有効な会員IDがありません。`,
    );
  }

  return new Set(
    memberIds,
  );
}
// async function loadActiveMemberIds():
// Promise<Set<string>> {
//   const doc =
//     await createSpreadsheetDoc(
//       MAIN_SPREADSHEET_ID,
//       "GOOGLE_SHEET_ID",
//     );

//   const usersSheet =
//     doc.sheetsByTitle[
//       "Users"
//     ];

//   if (!usersSheet) {
//     throw new Error(
//       "Usersシートが見つかりません。",
//     );
//   }

//   const rows =
//     await usersSheet.getRows();

//   return new Set(
//     rows
//       .filter(
//         (row) =>
//           !parseBoolean(
//             row.get(
//               "is_deleted",
//             ),
//           ),
//       )
//       .map(
//         (row) =>
//           normalizeMemberId(
//             row.get("id"),
//           ),
//       )
//       .filter(Boolean),
//   );
// }

// function assertRequiredHeaders(
//   sheet:
//     GoogleSpreadsheetWorksheet,
// ): void {
//   const headers =
//     sheet.headerValues ?? [];

//   const missingHeaders =
//     REQUIRED_HEADERS.filter(
//       (header) =>
//         !headers.includes(
//           header,
//         ),
//     );

//   if (
//     missingHeaders.length > 0
//   ) {
//     throw new Error(
//       `${sheet.title}に必要な列がありません：${missingHeaders.join(
//         "、",
//       )}`,
//     );
//   }
// }

function assertRequiredHeaders(
  sheet:
    GoogleSpreadsheetWorksheet,
): string {
  const headers =
    sheet.headerValues ?? [];

  const applyTokenHeader =
    APPLY_TOKEN_HEADERS.find(
      (header) =>
        headers.includes(header),
    );

  if (!applyTokenHeader) {
    throw new Error(
      `${sheet.title}に申込確認コード列がありません。対応する列名：${APPLY_TOKEN_HEADERS.join(
        " または ",
      )}`,
    );
  }

  const missingHeaders =
    REQUIRED_RESULT_HEADERS.filter(
      (header) =>
        !headers.includes(header),
    );

  if (
    missingHeaders.length > 0
  ) {
    throw new Error(
      `${sheet.title}に必要な列がありません：${missingHeaders.join(
        "、",
      )}`,
    );
  }

  return applyTokenHeader;
}

async function syncResponseSheet({
  sheet,
  eventId,
  activeMemberIds,
}: {
  sheet:
    GoogleSpreadsheetWorksheet;
  eventId: string;
  activeMemberIds:
    Set<string>;
}) {
  const rows =
    await sheet.getRows();
 const applyTokenHeader =
  assertRequiredHeaders(
    sheet,
  );

  let processed = 0;
  let valid = 0;
  let invalid = 0;
  let skipped = 0;

  for (const row of rows) {
    const currentResult =
      String(
        row.get(
          RESULT_HEADER,
        ) ?? "",
      ).trim();

    /*
     * 一度有効判定された回答は、
     * 通常の同期では書き換えない。
     */
    if (
      currentResult === "有効"
    ) {
      skipped += 1;
      continue;
    }

    const validation =
      validateEventResponseToken({
        token:
          row.get(
            applyTokenHeader
          ),

        expectedEventId:
          eventId,
      });

    let result:
      "有効" | "無効";

    let memberId = "";
    let error = "";

    if (!validation.valid) {
      result = "無効";
      error =
        validation.error;
      invalid += 1;
    } else if (
      !activeMemberIds.has(
        normalizeMemberId(
          validation.memberId,
        ),
      )
    ) {
      result = "無効";
      error =
        "会員が存在しません";
      invalid += 1;
    } else {
      result = "有効";
      memberId =
        normalizeMemberId(
          validation.memberId,
        );
      valid += 1;
    }

    row.set(
      RESULT_HEADER,
      result,
    );

    row.set(
      MEMBER_ID_RESULT_HEADER,
      memberId,
    );

    row.set(
      ERROR_HEADER,
      error,
    );

    row.set(
      VALIDATED_AT_HEADER,
      formatValidatedAt(
        new Date(),
      ),
    );

    await row.save();

    processed += 1;
  }

  return {
    processed,
    valid,
    invalid,
    skipped,
  };
}

/**
 * 回答一覧スプレッドシート内の
 * 「回答_eventId」タブを同期する。
 */
export async function syncEventResponseSheets():
Promise<EventResponseSyncResult> {
  const [
    responseDoc,
    activeMemberIds,
  ] =
    await Promise.all([
      createSpreadsheetDoc(
        RESPONSE_SPREADSHEET_ID,
        "GOOGLE_FORM_RESPONSE_SPREADSHEET_ID",
      ),

      loadActiveMemberIds(),
    ]);

  const result:
    EventResponseSyncResult = {
      processed: 0,
      valid: 0,
      invalid: 0,
      skipped: 0,
      sheets: [],
    };

  for (
    const sheet of
    responseDoc.sheetsByIndex
  ) {
    const eventId =
      getEventIdFromSheetName(
        sheet.title,
      );

    /*
     * 「回答_イベントID」以外の
     * シートは同期対象外。
     */
    if (!eventId) {
      continue;
    }

    const sheetResult =
      await syncResponseSheet({
        sheet,
        eventId,
        activeMemberIds,
      });

    result.processed +=
      sheetResult.processed;

    result.valid +=
      sheetResult.valid;

    result.invalid +=
      sheetResult.invalid;

    result.skipped +=
      sheetResult.skipped;

    result.sheets.push({
      sheetName:
        sheet.title,
      eventId,
      ...sheetResult,
    });
  }

  return result;
}