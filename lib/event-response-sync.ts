import "server-only";


import {
  GoogleSpreadsheet,
  type GoogleSpreadsheetWorksheet,
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


const ANSWER_SHEET_NAME =
  "answer";


const RESULT_HEADER =
  "判定結果";


const MEMBER_ID_HEADER =
  "会員ID";


const MEMBER_ID_RESULT_HEADER =
  "判定会員ID";


const ERROR_HEADER =
  "判定エラー";


const VALIDATED_AT_HEADER =
  "判定日時";


const TIMESTAMP_HEADERS = [
  "タイムスタンプ",
  "Timestamp",
] as const;


const REQUIRED_RESULT_HEADERS = [
  RESULT_HEADER,
  MEMBER_ID_RESULT_HEADER,
  ERROR_HEADER,
  VALIDATED_AT_HEADER,
];


const ANSWER_HEADERS = [
  "answer_id",
  "event_id",
  "member_id",
  "submitted_at",
  "answers_json",
  "validated_at",
  "synced_at",
] as const;


type ValidAnswer = {
  eventId: string;
  memberId: string;
  submittedAt: string;
  answersJson: string;
  validatedAt: string;
};


export type EventResponseSyncResult = {
  processed: number;
  valid: number;
  invalid: number;
  skipped: number;
  answerInserted: number;
  answerUpdated: number;
  registrationCountsUpdated: number;
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


function parseBoolean(
  value: unknown,
): boolean {
  if (
    typeof value === "boolean"
  ) {
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
   * 対応例：
   * 回答_11
   * 回答_11_夏季交流会
   */
  const match =
    sheetName.match(
      /^回答_([^_]+)(?:_|$)/,
    );


  return (
    match?.[1]?.trim() ||
    null
  );
}


function formatDateTime(
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


async function loadActiveMemberIds(
  mainDoc: GoogleSpreadsheet,
): Promise<Set<string>> {
  const usersSheet =
    mainDoc.sheetsByTitle[
      "Users"
    ];


  if (!usersSheet) {
    throw new Error(
      "Usersシートが見つかりません。",
    );
  }


  const rows =
    await usersSheet.getRows();


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
              "member_id",
            ),
          ),
      )
      .filter(Boolean);


  if (
    memberIds.length === 0
  ) {
    throw new Error(
      "Usersシートのmember_id列に有効な会員IDがありません。",
    );
  }


  return new Set(
    memberIds,
  );
}


async function getAnswerSheet(
  mainDoc: GoogleSpreadsheet,
): Promise<GoogleSpreadsheetWorksheet> {
  const answerSheet =
    mainDoc.sheetsByTitle[
      ANSWER_SHEET_NAME
    ];


  if (!answerSheet) {
    throw new Error(
      "answerシートが見つかりません。",
    );
  }


  await answerSheet.loadHeaderRow();


  const headers =
    answerSheet.headerValues ?? [];


  const missingHeaders =
    ANSWER_HEADERS.filter(
      (header) =>
        !headers.includes(
          header,
        ),
    );


  if (
    missingHeaders.length > 0
  ) {
    throw new Error(
      `answerシートに必要な列がありません：${missingHeaders.join(
        "、",
      )}`,
    );
  }


  return answerSheet;
}


function assertRequiredHeaders(
  sheet:
    GoogleSpreadsheetWorksheet,
): {
  memberIdHeader: string;
  timestampHeader: string;
} {
  const headers =
    sheet.headerValues ?? [];


  if (
    !headers.includes(
      MEMBER_ID_HEADER,
    )
  ) {
    throw new Error(
      `${sheet.title}に会員ID列がありません。`,
    );
  }


  const timestampHeader =
    TIMESTAMP_HEADERS.find(
      (header) =>
        headers.includes(
          header,
        ),
    );


  if (!timestampHeader) {
    throw new Error(
      `${sheet.title}にタイムスタンプ列がありません。`,
    );
  }


  const missingHeaders =
    REQUIRED_RESULT_HEADERS.filter(
      (header) =>
        !headers.includes(
          header,
        ),
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


  return {
    memberIdHeader:
      MEMBER_ID_HEADER,
    timestampHeader,
  };
}


function createAnswersJson({
  sheet,
  row,
  memberIdHeader,
  timestampHeader,
}: {
  sheet:
    GoogleSpreadsheetWorksheet;
  row: {
    get:
      (header: string) =>
        unknown;
  };
  memberIdHeader: string;
  timestampHeader: string;
}): string {
  const excludedHeaders =
    new Set([
      memberIdHeader,
      timestampHeader,
      ...TIMESTAMP_HEADERS,
      RESULT_HEADER,
      MEMBER_ID_RESULT_HEADER,
      ERROR_HEADER,
      VALIDATED_AT_HEADER,
    ]);


  const answers:
    Record<string, string> = {};


  for (
    const header of
    sheet.headerValues ?? []
  ) {
    if (
      excludedHeaders.has(
        header,
      )
    ) {
      continue;
    }


    answers[header] =
      String(
        row.get(header) ?? "",
      ).trim();
  }


  return JSON.stringify(
    answers,
  );
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


  const {
    memberIdHeader,
    timestampHeader,
  } =
    assertRequiredHeaders(
      sheet,
    );


  let processed = 0;
  let valid = 0;
  let invalid = 0;
  let skipped = 0;


  const validAnswers:
    ValidAnswer[] = [];


  for (const row of rows) {
    let result:
      "有効" | "無効";


    const memberId =
      normalizeMemberId(
        row.get(
          memberIdHeader,
        ),
      );


    let error = "";


    if (!memberId) {
      result = "無効";
      error =
        "会員IDが入力されていません";
      invalid += 1;
    } else if (
      !activeMemberIds.has(
        memberId,
      )
    ) {
      result = "無効";
      error =
        "Usersシートに会員が存在しません";
      invalid += 1;
    } else {
      result = "有効";
      valid += 1;
    }


    const currentResult =
      String(
        row.get(
          RESULT_HEADER,
        ) ?? "",
      ).trim();


    const currentMemberId =
      normalizeMemberId(
        row.get(
          MEMBER_ID_RESULT_HEADER,
        ),
      );


    const currentError =
      String(
        row.get(
          ERROR_HEADER,
        ) ?? "",
      ).trim();


    const currentValidatedAt =
      String(
        row.get(
          VALIDATED_AT_HEADER,
        ) ?? "",
      ).trim();


    const hasChanged =
      currentResult !== result ||
      currentMemberId !==
        memberId ||
      currentError !== error ||
      !currentValidatedAt;


    let validatedAt =
      currentValidatedAt;


    if (hasChanged) {
      validatedAt =
        formatDateTime(
          new Date(),
        );


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
        validatedAt,
      );


      await row.save();


      processed += 1;
    } else {
      skipped += 1;
    }


    if (
      result === "有効"
    ) {
      validAnswers.push({
        eventId,
        memberId,
        submittedAt:
          String(
            row.get(
              timestampHeader,
            ) ?? "",
          ).trim(),


        answersJson:
          createAnswersJson({
            sheet,
            row,
            memberIdHeader,
            timestampHeader,
          }),


        validatedAt,
      });
    }
  }


  return {
    processed,
    valid,
    invalid,
    skipped,
    validAnswers,
  };
}


async function upsertValidAnswers({
  answerSheet,
  validAnswers,
}: {
  answerSheet:
    GoogleSpreadsheetWorksheet;
  validAnswers:
    ValidAnswer[];
}): Promise<{
  inserted: number;
  updated: number;
}> {
  const rows =
    await answerSheet.getRows();


  const rowByKey =
    new Map<
      string,
      (typeof rows)[number]
    >();


  for (const row of rows) {
    const eventId =
      String(
        row.get(
          "event_id",
        ) ?? "",
      ).trim();


    const memberId =
      normalizeMemberId(
        row.get(
          "member_id",
        ),
      );


    const rowKey =
      `${eventId}::${memberId}`;


    rowByKey.set(
      rowKey,
      row,
    );
  }


  let inserted = 0;
  let updated = 0;


  for (
    const answer of
    validAnswers
  ) {
    const key =
      `${answer.eventId}::${answer.memberId}`;


    const existingRow =
      rowByKey.get(key);


    const answerId =
      existingRow
        ? String(
            existingRow.get(
              "answer_id",
            ) ?? "",
          ).trim() ||
          `ans_${answer.eventId}_${answer.memberId}`
        : `ans_${answer.eventId}_${answer.memberId}`;


    const sourceValues = {
      answer_id:
        answerId,
      event_id:
        answer.eventId,
      member_id:
        answer.memberId,
      submitted_at:
        answer.submittedAt,
      answers_json:
        answer.answersJson,
      validated_at:
        answer.validatedAt,
    };


    if (!existingRow) {
      const newRow =
        await answerSheet.addRow(
          {
            ...sourceValues,
            synced_at:
              formatDateTime(
                new Date(),
              ),
          },
          {
            raw: true,
          },
        );


      rowByKey.set(
        key,
        newRow,
      );


      inserted += 1;
      continue;
    }


    const hasChanged =
      Object.entries(
        sourceValues,
      ).some(
        ([header, value]) =>
          String(
            existingRow.get(
              header,
            ) ?? "",
          ).trim() !==
          String(value).trim(),
      );


    if (!hasChanged) {
      continue;
    }


    for (
      const [
        header,
        value,
      ] of Object.entries(
        sourceValues,
      )
    ) {
      existingRow.set(
        header,
        value,
      );
    }


    existingRow.set(
      "synced_at",
      formatDateTime(
        new Date(),
      ),
    );


    await existingRow.save();


    updated += 1;
  }


  return {
    inserted,
    updated,
  };
}


async function updateEventRegistrationCounts({
  mainDoc,
  answerSheet,
}: {
  mainDoc: GoogleSpreadsheet;
  answerSheet:
    GoogleSpreadsheetWorksheet;
}): Promise<number> {
  const eventsSheet =
    mainDoc.sheetsByTitle[
      "Events"
    ];


  if (!eventsSheet) {
    throw new Error(
      "Eventsシートが見つかりません。",
    );
  }


  await eventsSheet.loadHeaderRow();


  const headers =
    eventsSheet.headerValues ?? [];


  const requiredHeaders = [
    "event_id",
    "registration_count",
  ];


  const missingHeaders =
    requiredHeaders.filter(
      (header) =>
        !headers.includes(
          header,
        ),
    );


  if (
    missingHeaders.length > 0
  ) {
    throw new Error(
      `eventsシートに必要な列がありません：${missingHeaders.join(
        "、",
      )}`,
    );
  }


  const [
    answerRows,
    eventRows,
  ] =
    await Promise.all([
      answerSheet.getRows(),
      eventsSheet.getRows(),
    ]);


  const countByEventId =
    new Map<string, number>();


  for (
    const row of answerRows
  ) {
    const eventId =
      String(
        row.get(
          "event_id",
        ) ?? "",
      ).trim();


    const memberId =
      normalizeMemberId(
        row.get(
          "member_id",
        ),
      );


    if (
      !eventId ||
      !memberId
    ) {
      continue;
    }


    countByEventId.set(
      eventId,
      (
        countByEventId.get(
          eventId,
        ) ?? 0
      ) + 1,
    );
  }


  let updated = 0;


  for (
    const row of eventRows
  ) {
    const eventId =
      String(
        row.get(
          "event_id",
        ) ?? "",
      ).trim();


    if (!eventId) {
      continue;
    }


    const nextCount =
      countByEventId.get(
        eventId,
      ) ?? 0;


    const currentRaw =
      String(
        row.get(
          "registration_count",
        ) ?? "",
      ).trim();


    const currentCount =
      Number(currentRaw);


    if (
      currentRaw !== "" &&
      Number.isFinite(
        currentCount,
      ) &&
      currentCount ===
        nextCount
    ) {
      continue;
    }


    row.set(
      "registration_count",
      nextCount,
    );


    await row.save();


    updated += 1;
  }


  return updated;
}


/**
 * 回答一覧を検証し、
 * 有効回答だけをanswerシートへ同期する。
 */
export async function syncEventResponseSheets():
Promise<EventResponseSyncResult> {
  const [
    responseDoc,
    mainDoc,
  ] =
    await Promise.all([
      createSpreadsheetDoc(
        RESPONSE_SPREADSHEET_ID,
        "GOOGLE_FORM_RESPONSE_SPREADSHEET_ID",
      ),


      createSpreadsheetDoc(
        MAIN_SPREADSHEET_ID,
        "GOOGLE_SHEET_ID",
      ),
    ]);


  const [
    activeMemberIds,
    answerSheet,
  ] =
    await Promise.all([
      loadActiveMemberIds(
        mainDoc,
      ),


      getAnswerSheet(
        mainDoc,
      ),
    ]);


  const result:
    EventResponseSyncResult = {
      processed: 0,
      valid: 0,
      invalid: 0,
      skipped: 0,
      answerInserted: 0,
      answerUpdated: 0,
      registrationCountsUpdated: 0,
      sheets: [],
    };


  const allValidAnswers:
    ValidAnswer[] = [];


  for (
    const sheet of
    responseDoc.sheetsByIndex
  ) {
    const eventId =
      getEventIdFromSheetName(
        sheet.title,
      );


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


    allValidAnswers.push(
      ...sheetResult.validAnswers,
    );


    result.sheets.push({
      sheetName:
        sheet.title,
      eventId,
      processed:
        sheetResult.processed,
      valid:
        sheetResult.valid,
      invalid:
        sheetResult.invalid,
      skipped:
        sheetResult.skipped,
    });
  }


  const answerResult =
    await upsertValidAnswers({
      answerSheet,
      validAnswers:
        allValidAnswers,
    });


  result.answerInserted =
    answerResult.inserted;


  result.answerUpdated =
    answerResult.updated;


  result.registrationCountsUpdated =
    await updateEventRegistrationCounts({
      mainDoc,
      answerSheet,
    });


  return result;
}


