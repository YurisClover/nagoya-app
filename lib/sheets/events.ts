import "server-only";
import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import { getSpreadsheet } from "@/lib/sheets/client";
export type EventStatus = "draft" | "published" | "closed";
export type EventPosition = "general" | "executive";
export type SheetEvent = {
  event_id: string;
  title: string;
  event_date: string;
  event_end_date: string;
  location: string;
  position: EventPosition;
  form_id: string;
  form_url: string;
  status: EventStatus;
  created_by: string;
  created_at: string;
  registration_count: number;
  is_deleted: boolean;
  prefill_url_template: string;
  response_sheet_name: string;
  response_sheet_id: string;
};

const REQUIRED_EVENT_HEADERS = [
  "event_id",
  "title",
  "event_date",
  "event_end_date",
  "location",
  "position",
  "form_id",
  "form_url",
  "status",
  "created_by",
  "created_at",
  "registration_count",
  "is_deleted",
  "prefill_url_template",
  "response_sheet_name",
  "response_sheet_id",
] as const;

function isEventStatus(value: string): value is EventStatus {
  return value === "draft" || value === "published" || value === "closed";
}

function isEventPosition(value: string): value is EventPosition {
  return value === "general" || value === "executive";
}

function parseBoolean(value: unknown): boolean {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

function mapEventRow(row: GoogleSpreadsheetRow): SheetEvent {
  const statusValue = String(row.get("status") ?? "");
  const positionValue = String(row.get("position") ?? "");

  return {
    event_id: String(row.get("event_id") ?? ""),
    title: String(row.get("title") ?? ""),
    event_date: String(row.get("event_date") ?? ""),
    event_end_date: String(row.get("event_end_date") ?? ""),
    location: String(row.get("location") ?? ""),
    /*
     * 既存のテストデータで空欄の場合は
     * 一般会員向けとして扱う。
     */
    position: isEventPosition(positionValue) ? positionValue : "general",
    form_id: String(row.get("form_id") ?? ""),
    form_url: String(row.get("form_url") ?? ""),
    status: isEventStatus(statusValue) ? statusValue : "draft",
    created_by: String(row.get("created_by") ?? ""),
    created_at: String(row.get("created_at") ?? ""),
    registration_count: Number(row.get("registration_count") ?? 0) || 0,
    /*
     * trueなら削除済み。
     * 空欄やfalseは未削除として扱う。
     */
    is_deleted: parseBoolean(row.get("is_deleted")),
    /*
     * 会員IDを事前入力するための
     * GoogleフォームURLひな型。
     *
     * 既存イベントでは空欄を許容する。
     */
    prefill_url_template: String(row.get("prefill_url_template") ?? "").trim(),
    response_sheet_name: String(row.get("response_sheet_name") ?? "").trim(),
    response_sheet_id: String(row.get("response_sheet_id") ?? "").trim(),
  };
}

/**
 * Eventsシートを取得する
 */
async function getEventsSheet() {
  const document = await getSpreadsheet();
  const sheet = document.sheetsByTitle["Events"];
  if (!sheet) {
    throw new Error("'Events' sheet not found");
  }
  await sheet.loadHeaderRow();
  const missingHeaders = REQUIRED_EVENT_HEADERS.filter(
    (header) => !sheet.headerValues.includes(header),
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Eventsシートに必要な列がありません: ${missingHeaders.join(", ")}`,
    );
  }
  return sheet;
}

/**
 * Eventsシートへイベントを追加する。
 *
 * event_idは既存の数値IDの
 * 最大値+1で発行する。
 */
export async function addEventToSheet(
  event: Omit<SheetEvent, "event_id">,
): Promise<SheetEvent> {
  const sheet = await getEventsSheet();
  const rows = await sheet.getRows();
  const maximumEventId = rows.reduce((currentMaximum, row) => {
    const eventId = Number(row.get("event_id"));

    /*
     * 既存のUUIDなど、
     * 正の整数ではないIDは
     * 採番計算から除外する。
     */
    if (!Number.isInteger(eventId) || eventId < 1) {
      return currentMaximum;
    }

    return Math.max(currentMaximum, eventId);
  }, 0);

  const createdEvent: SheetEvent = {
    ...event,
    event_id: String(maximumEventId + 1),
  };

  await sheet.addRow(
    {
      event_id: String(createdEvent.event_id),
      title: createdEvent.title,
      event_date: createdEvent.event_date,
      event_end_date: createdEvent.event_end_date,
      location: createdEvent.location,
      position: createdEvent.position,
      form_id: createdEvent.form_id,
      form_url: createdEvent.form_url,
      status: createdEvent.status,
      created_by: createdEvent.created_by,
      created_at: createdEvent.created_at,
      registration_count: createdEvent.registration_count,
      is_deleted: createdEvent.is_deleted,
      prefill_url_template: createdEvent.prefill_url_template,
    },
    {
      raw: true,
      insert: true,
    },
  );
  return createdEvent;
}

/**
 * Eventsシートからイベント一覧を取得する
 */
export async function getEventsFromSheet(): Promise<SheetEvent[]> {
  const sheet = await getEventsSheet();
  const rows = await sheet.getRows();
  const events = rows
    .map(mapEventRow)
    .filter((event) => Boolean(event.event_id) && !event.is_deleted);
  const now = Date.now();

  /*
   * 開催前：
   *   開始日時が近い順
   *
   * 開催済み：
   *   新しい順で一覧の後ろ
   */
//   events.sort((eventA, eventB) => {
//     const dateA = new Date(eventA.event_date).getTime();
//     const dateB = new Date(eventB.event_date).getTime();
//     const validDateA = Number.isNaN(dateA) ? Number.MAX_SAFE_INTEGER : dateA;
//     const validDateB = Number.isNaN(dateB) ? Number.MAX_SAFE_INTEGER : dateB;
//     const isPastA = validDateA < now;
//     const isPastB = validDateB < now;

//     if (isPastA !== isPastB) {
//       return isPastA ? 1 : -1;
//     }

//     if (isPastA && isPastB) {
//       return validDateB - validDateA;
//     }

//     return validDateA - validDateB;
//   });

    const idNum = (value: string) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : -Infinity;
    };
    events.sort((a, b) => idNum(b.event_id) - idNum(a.event_id));

  return events;
}

type SynchronizeGoogleForm = (formId: string) => Promise<void>;
/**
 * Googleフォームを同期した後、
 * Eventsシートのstatusを更新する
 */
export async function updateEventStatus(
  eventId: string,
  status: EventStatus,
  synchronizeGoogleForm: SynchronizeGoogleForm,
): Promise<SheetEvent> {
  const sheet = await getEventsSheet();
  const rows = await sheet.getRows();
  const eventRow = rows.find(
    (row) => String(row.get("event_id") ?? "") === eventId,
  );

  if (!eventRow) {
    throw new Error("対象のイベントが見つかりません。");
  }

  const formId = String(eventRow.get("form_id") ?? "");
  if (!formId) {
    throw new Error("イベントにGoogleフォームIDが設定されていません。");
  }

  /*
   * 先にGoogleフォームを更新する。
   * Google側で失敗した場合は、
   * Eventsシートは変更しない。
   */
  await synchronizeGoogleForm(formId);
  eventRow.set("status", status);
  await eventRow.save({ raw: true });
  return mapEventRow(eventRow);
}

/**
 * Eventsシートのイベント対象者を変更する。
 *
 * Googleフォーム自体は変更しない。
 */
export async function updateEventPosition(
  eventId: string,
  position: EventPosition,
): Promise<SheetEvent> {
  const sheet = await getEventsSheet();
  const rows = await sheet.getRows();
  const eventRow = rows.find(
    (row) => String(row.get("event_id") ?? "") === eventId,
  );

  if (!eventRow) {
    throw new Error("対象のイベントが見つかりません。");
  }

  eventRow.set("position", position);
  await eventRow.save({ raw: true });
  return mapEventRow(eventRow);
}

type MakeGoogleFormPrivate = (formId: string) => Promise<void>;
/**
 * Googleフォームを非公開・受付停止にした後、
 * Eventsシートを論理削除する。
 */
export async function softDeleteEvent(
  eventId: string,
  makeGoogleFormPrivate: MakeGoogleFormPrivate,
): Promise<SheetEvent> {
  const sheet = await getEventsSheet();
  const rows = await sheet.getRows();
  const eventRow = rows.find(
    (row) => String(row.get("event_id") ?? "") === eventId,
  );

  if (!eventRow) {
    throw new Error("対象のイベントが見つかりません。");
  }

  if (parseBoolean(eventRow.get("is_deleted"))) {
    throw new Error("このイベントはすでに削除されています。");
  }

  const formId = String(eventRow.get("form_id") ?? "");

  if (!formId) {
    throw new Error("イベントにGoogleフォームIDが設定されていません。");
  }

  /*
   * Googleフォーム側が失敗した場合は、
   * is_deletedを変更しない。
   */
  await makeGoogleFormPrivate(formId);
  eventRow.set("status", "draft");
  eventRow.set("is_deleted", true);
  await eventRow.save({ raw: true });
  return mapEventRow(eventRow);
}

type UpdateEventResponseSheetInfoInput = {
  eventId: string;
  responseSheetName: string;
  responseSheetId: number;
};

export async function updateEventResponseSheetInfo({
  eventId,
  responseSheetName,
  responseSheetId,
}: UpdateEventResponseSheetInfoInput): Promise<SheetEvent> {
  const normalizedEventId = eventId.trim();

  if (!normalizedEventId) {
    throw new Error("イベントIDが指定されていません。");
  }

  const doc = await getSpreadsheet();
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle["Events"];

  if (!sheet) {
    throw new Error("Eventsシートが見つかりません。");
  }

  await sheet.loadHeaderRow();
  const headers = sheet.headerValues ?? [];
  const requiredHeaders = [
    "event_id",
    "response_sheet_name",
    "response_sheet_id",
  ];

  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Eventsシートに必要な列がありません：${missingHeaders.join("、")}`,
    );
  }

  const rows = await sheet.getRows();
  const targetRow = rows.find(
    (row) => String(row.get("event_id") ?? "").trim() === normalizedEventId,
  );

  if (!targetRow) {
    throw new Error(`イベントID ${normalizedEventId} が見つかりません。`);
  }

  targetRow.set("response_sheet_name", responseSheetName.trim());
  targetRow.set("response_sheet_id", String(responseSheetId));
  await targetRow.save({ raw: true });

  return mapEventRow(targetRow);
}
