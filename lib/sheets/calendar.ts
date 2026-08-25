import "server-only";
import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import { getSpreadsheet } from "@/lib/sheets/client";
import { nowJST } from "@/lib/datetime";

export type CalendarSyncStatus = "" | "synced" | "error";
export type CalendarRecord = {
  event_id: string;
  google_calendar_event_id: string;
  google_calendar_id: string;
  calendar_sync_status: CalendarSyncStatus;
  calendar_synced_at: string;
};
const CALENDAR_SHEET_NAME = "Calendar";
const REQUIRED_CALENDAR_HEADERS = [
  "event_id",
  "google_calendar_event_id",
  "google_calendar_id",
  "calendar_sync_status",
  "calendar_synced_at",
] as const;

function isCalendarSyncStatus(value: string): value is CalendarSyncStatus {
  return value === "" || value === "synced" || value === "error";
}
function mapCalendarRow(row: GoogleSpreadsheetRow): CalendarRecord {
  const statusValue = String(row.get("calendar_sync_status") ?? "").trim();
  return {
    event_id: String(row.get("event_id") ?? "").trim(),
    google_calendar_event_id: String(
      row.get("google_calendar_event_id") ?? "",
    ).trim(),
    google_calendar_id: String(row.get("google_calendar_id") ?? "").trim(),
    calendar_sync_status: isCalendarSyncStatus(statusValue)
      ? statusValue
      : "error",
    calendar_synced_at: String(row.get("calendar_synced_at") ?? "").trim(),
  };
}

/**
 * Calendarシートを取得し、
 * 必要なヘッダーが存在するか確認する。
 */
async function getCalendarSheet() {
  const document = await getSpreadsheet();
  const sheet = document.sheetsByTitle[CALENDAR_SHEET_NAME];
  if (!sheet) {
    throw new Error("Calendarシートが見つかりません。");
  }
  await sheet.loadHeaderRow();

  const missingHeaders = REQUIRED_CALENDAR_HEADERS.filter(
    (header) => !sheet.headerValues.includes(header),
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `Calendarシートに必要な列がありません: ${missingHeaders.join("、")}`,
    );
  }
  return sheet;
}

/**
 * Calendarシートの全レコードを取得する。
 */
export async function getCalendarRecords(): Promise<CalendarRecord[]> {
  const sheet = await getCalendarSheet();
  const rows = await sheet.getRows();
  return rows.map(mapCalendarRow).filter((record) => Boolean(record.event_id));
}

/**
 * event_idに対応するレコードを取得する。
 */
export async function getCalendarRecord(
  eventId: string,
): Promise<CalendarRecord | null> {
  const normalizedEventId = eventId.trim();
  if (!normalizedEventId) {
    throw new Error("イベントIDが指定されていません。");
  }
  const records = await getCalendarRecords();
  return (
    records.find((record) => record.event_id === normalizedEventId) ?? null
  );
}

/**
 * event_idを基準に、追加または更新する。
 */
export async function upsertCalendarRecord(
  record: CalendarRecord,
): Promise<CalendarRecord> {
  const eventId = record.event_id.trim();
  if (!eventId) {
    throw new Error("イベントIDが指定されていません。");
  }
  const sheet = await getCalendarSheet();
  const rows = await sheet.getRows();
  const targetRow = rows.find(
    (row) => String(row.get("event_id") ?? "").trim() === eventId,
  );
  const values = {
    event_id: eventId,
    google_calendar_event_id: record.google_calendar_event_id.trim(),
    google_calendar_id: record.google_calendar_id.trim(),
    calendar_sync_status: record.calendar_sync_status,
    calendar_synced_at: record.calendar_synced_at.trim(),
  };
  if (targetRow) {
    for (const [key, value] of Object.entries(values)) {
      targetRow.set(key, value);
    }
    await targetRow.save({ raw: true });
    return mapCalendarRow(targetRow);
  }
  const createdRow = await sheet.addRow(values, { raw: true, insert: true });
  return mapCalendarRow(createdRow);
}

/**
 * Googleカレンダーとの同期成功を記録する。
 */
export async function saveCalendarSyncSuccess({
  eventId,
  googleCalendarEventId,
  googleCalendarId,
}: {
  eventId: string;
  googleCalendarEventId: string;
  googleCalendarId: string;
}): Promise<CalendarRecord> {
  return upsertCalendarRecord({
    event_id: eventId,
    google_calendar_event_id: googleCalendarEventId,
    google_calendar_id: googleCalendarId,
    calendar_sync_status: "synced",
    calendar_synced_at: nowJST(),
  });
}

/**
 * 同期失敗を記録する。
 *
 * 既にGoogleカレンダー予定が存在する場合は、
 * 予定IDと最後の成功日時を残す。
 */
export async function saveCalendarSyncError(
  eventId: string,
): Promise<CalendarRecord> {
  const existingRecord = await getCalendarRecord(eventId);
  return upsertCalendarRecord({
    event_id: eventId,
    google_calendar_event_id: existingRecord?.google_calendar_event_id ?? "",
    google_calendar_id: existingRecord?.google_calendar_id ?? "",
    calendar_sync_status: "error",
    calendar_synced_at: existingRecord?.calendar_synced_at ?? "",
  });
}

/**
 * Googleカレンダー予定を削除できた後、
 * 連携情報を空欄へ戻す。
 */
export async function clearCalendarRecord(
  eventId: string,
): Promise<CalendarRecord> {
  return upsertCalendarRecord({
    event_id: eventId,
    google_calendar_event_id: "",
    google_calendar_id: "",
    calendar_sync_status: "",
    calendar_synced_at: "",
  });
}
