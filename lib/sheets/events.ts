import { randomUUID } from "node:crypto";
import "server-only";
import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import { getSpreadsheet } from "@/lib/sheets/client";
import { nowJST } from "@/lib/datetime";
import { compareByNearestStart } from "@/lib/event-order";
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

type EventsSheet = Awaited<ReturnType<typeof getEventsSheet>>;

/**
 * 指定行の1セルだけを「本物の boolean」として書き込む。
 *
 * 行単位の書き込み(addRow / row.save)は raw / USER_ENTERED を
 * 行全体でしか選べない:
 *   - raw:true  … "true"/"false" が文字列で入り、'true(アポストロフィ)表示になる
 *   - raw:false … 同じ行の ISO 日付文字列まで日付値に変換されて読み取り側が壊れる
 * セル単位 API(loadCells → cell.value = boolean)は型付きで書けるため、
 * 他シートと同じ「素の TRUE / FALSE(boolean セル)」になる。
 */
async function setBooleanCell(
  sheet: EventsSheet,
  rowNumber: number,
  header: string,
  value: boolean,
): Promise<void> {
  const columnIndex = sheet.headerValues.indexOf(header);
  if (columnIndex === -1) return;

  const rowIndex = rowNumber - 1; // rowNumber は1始まり、cell API は0始まり
  await sheet.loadCells({
    startRowIndex: rowIndex,
    endRowIndex: rowIndex + 1,
    startColumnIndex: columnIndex,
    endColumnIndex: columnIndex + 1,
  });
  sheet.getCell(rowIndex, columnIndex).value = value;
  await sheet.saveUpdatedCells();
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
 * Append a new event to the Events sheet.
 *
 * event_id is issued as a UUID (crypto.randomUUID) per the spec. Legacy
 * numeric ids (1, 2, 3, ...) may still exist in the sheet; every consumer
 * compares ids as plain strings, so both formats can coexist safely.
 */
export async function addEventToSheet(
  event: Omit<SheetEvent, "event_id">,
): Promise<SheetEvent> {
  const sheet = await getEventsSheet();

  const createdEvent: SheetEvent = {
    ...event,
    event_id: randomUUID(),
  };

  const createdRow = await sheet.addRow(
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
      // いったん文字列で入れておき、直後にセル単位 API で boolean に上書きする。
      // (文字列はフォールバック — 万一セル更新に失敗しても parseBoolean は読める)
      is_deleted: createdEvent.is_deleted ? "true" : "false",
      prefill_url_template: createdEvent.prefill_url_template,
    },
    {
      raw: true,
      insert: true,
    },
  );

  // is_deleted セルだけ boolean 型で上書きし、他シートと同じ素の FALSE 表示に揃える。
  // 失敗しても "false" 文字列が既に入っており読み取りは壊れないため握りつぶす。
  try {
    await setBooleanCell(sheet, createdRow.rowNumber, "is_deleted", createdEvent.is_deleted);
  } catch (error) {
    console.warn("is_deleted セルの boolean 化に失敗しました(表示のみの問題):", error);
  }

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
// 並び順は共通ロジックに集約(lib/event-order.ts 参照)
  events.sort(compareByNearestStart(nowJST().slice(0, 10)));

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
  await eventRow.save({ raw: true });

  // is_deleted は行単位ではなくセル単位で boolean として書く(理由は setBooleanCell 参照)
  await setBooleanCell(sheet, eventRow.rowNumber, "is_deleted", true);

  // eventRow のメモリ上の値は更新していないため、戻り値では明示的に true を立てる
  return { ...mapEventRow(eventRow), is_deleted: true };
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
