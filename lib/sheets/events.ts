import "server-only";

import {getSpreadsheet,} from "@/lib/sheets/client";

export type EventStatus =
  | "private"
  | "published"
  | "closed";

export type SheetEvent = {
  event_id: string;
  title: string;
  event_date: string;
  location: string;
  form_id: string;
  form_url: string;
  status: EventStatus;
  created_by: string;
  created_at: string;
  registration_count: number;
};

const REQUIRED_EVENT_HEADERS = [
  "event_id",
  "title",
  "event_date",
  "location",
  "form_id",
  "form_url",
  "status",
  "created_by",
  "created_at",
  "registration_count",
];

/**
 * Eventsシートを取得する
 */
async function getEventsSheet() {
  const document =
    await getSpreadsheet();

  const sheet =
    document.sheetsByTitle["Events"];

  if (!sheet) {
    throw new Error(
      "'Events' sheet not found",
    );
  }

  await sheet.loadHeaderRow();

  return sheet;
}

/**
 * Eventsシートへイベントを追加する
 */
export async function addEventToSheet(
  event: SheetEvent,
) {
  const sheet =
    await getEventsSheet();

  const missingHeaders =
    REQUIRED_EVENT_HEADERS.filter(
      (header) =>
        !sheet.headerValues.includes(
          header,
        ),
    );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Eventsシートに必要な列がありません: ${missingHeaders.join(", ")}`,
    );
  }

  await sheet.addRow(
    {
      event_id: event.event_id,
      title: event.title,
      event_date: event.event_date,
      location: event.location,
      form_id: event.form_id,
      form_url: event.form_url,
      status: event.status,
      created_by: event.created_by,
      created_at: event.created_at,
      registration_count:
        event.registration_count,
    },
    {
      raw: true,
      insert: true,
    },
  );
}