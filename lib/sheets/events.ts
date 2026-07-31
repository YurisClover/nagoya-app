import "server-only";

import type {
  GoogleSpreadsheetRow,
} from "google-spreadsheet";

import {
  getSpreadsheet,
} from "@/lib/sheets/client";

export type EventStatus =
  | "private"
  | "published"
  | "closed";

export type EventAudience =
  | "general"
  | "executive";

export type SheetEvent = {
  event_id: string;
  title: string;
  event_date: string;
  event_end_date: string;
  location: string;
  audience: EventAudience;
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
  "event_end_date",
  "location",
  "audience",
  "form_id",
  "form_url",
  "status",
  "created_by",
  "created_at",
  "registration_count",
] as const;

function isEventStatus(
  value: string,
): value is EventStatus {
  return (
    value === "private" ||
    value === "published" ||
    value === "closed"
  );
}

function isEventAudience(
  value: string,
): value is EventAudience {
  return (
    value === "general" ||
    value === "executive"
  );
}

function mapEventRow(
  row: GoogleSpreadsheetRow,
): SheetEvent {
  const statusValue =
    String(
      row.get("status") ?? "",
    );

  const audienceValue =
    String(
      row.get("audience") ?? "",
    );

  return {
    event_id: String(
      row.get("event_id") ?? "",
    ),

    title: String(
      row.get("title") ?? "",
    ),

    event_date: String(
      row.get("event_date") ?? "",
    ),

    event_end_date: String(
      row.get("event_end_date") ?? "",
    ),

    location: String(
      row.get("location") ?? "",
    ),

    /*
     * 既存のテストデータで空欄の場合は
     * 一般会員向けとして扱う。
     */
    audience:
      isEventAudience(
        audienceValue,
      )
        ? audienceValue
        : "general",

    form_id: String(
      row.get("form_id") ?? "",
    ),

    form_url: String(
      row.get("form_url") ?? "",
    ),

    status:
      isEventStatus(
        statusValue,
      )
        ? statusValue
        : "private",

    created_by: String(
      row.get("created_by") ?? "",
    ),

    created_at: String(
      row.get("created_at") ?? "",
    ),

    registration_count:
      Number(
        row.get(
          "registration_count",
        ) ?? 0,
      ) || 0,
  };
}

/**
 * Eventsシートを取得する
 */
async function getEventsSheet() {
  const document =
    await getSpreadsheet();

  const sheet =
    document.sheetsByTitle[
      "Events"
    ];

  if (!sheet) {
    throw new Error(
      "'Events' sheet not found",
    );
  }

  await sheet.loadHeaderRow();

  const missingHeaders =
    REQUIRED_EVENT_HEADERS.filter(
      (header) =>
        !sheet.headerValues.includes(
          header,
        ),
    );

  if (
    missingHeaders.length > 0
  ) {
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
  event: Omit<
    SheetEvent,
    "event_id"
  >,
): Promise<SheetEvent> {
  const sheet =
    await getEventsSheet();

  const rows =
    await sheet.getRows();

  const maximumEventId =
    rows.reduce(
      (
        currentMaximum,
        row,
      ) => {
        const eventId =
          Number(
            row.get(
              "event_id",
            ),
          );

        /*
         * 既存のUUIDなど、
         * 正の整数ではないIDは
         * 採番計算から除外する。
         */
        if (
          !Number.isInteger(
            eventId,
          ) ||
          eventId < 1
        ) {
          return currentMaximum;
        }

        return Math.max(
          currentMaximum,
          eventId,
        );
      },
      0,
    );

  const createdEvent:
  SheetEvent = {
    ...event,
    event_id: String(
      maximumEventId + 1,
    ),
  };

  await sheet.addRow(
    {
      event_id:
        createdEvent.event_id,

      title:
        createdEvent.title,

      event_date:
        createdEvent.event_date,

      event_end_date:
        createdEvent.event_end_date,

      location:
        createdEvent.location,

      audience:
        createdEvent.audience,

      form_id:
        createdEvent.form_id,

      form_url:
        createdEvent.form_url,

      status:
        createdEvent.status,

      created_by:
        createdEvent.created_by,

      created_at:
        createdEvent.created_at,

      registration_count:
        createdEvent.registration_count,
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
export async function getEventsFromSheet():
Promise<SheetEvent[]> {
  const sheet =
    await getEventsSheet();

  const rows =
    await sheet.getRows();

  const events =
    rows
      .map(mapEventRow)
      .filter(
        (event) =>
          Boolean(
            event.event_id,
          ),
      );

  const now =
    Date.now();

  /*
   * 開催前：
   *   開始日時が近い順
   *
   * 開催済み：
   *   新しい順で一覧の後ろ
   */
  events.sort(
    (
      eventA,
      eventB,
    ) => {
      const dateA =
        new Date(
          eventA.event_date,
        ).getTime();

      const dateB =
        new Date(
          eventB.event_date,
        ).getTime();

      const validDateA =
        Number.isNaN(dateA)
          ? Number.MAX_SAFE_INTEGER
          : dateA;

      const validDateB =
        Number.isNaN(dateB)
          ? Number.MAX_SAFE_INTEGER
          : dateB;

      const isPastA =
        validDateA < now;

      const isPastB =
        validDateB < now;

      if (
        isPastA !== isPastB
      ) {
        return isPastA
          ? 1
          : -1;
      }

      if (
        isPastA &&
        isPastB
      ) {
        return (
          validDateB -
          validDateA
        );
      }

      return (
        validDateA -
        validDateB
      );
    },
  );

  return events;
}

type SynchronizeGoogleForm =
  (
    formId: string,
  ) => Promise<void>;

/**
 * Googleフォームを同期した後、
 * Eventsシートのstatusを更新する
 */
export async function updateEventStatus(
  eventId: string,
  status: EventStatus,
  synchronizeGoogleForm:
    SynchronizeGoogleForm,
): Promise<SheetEvent> {
  const sheet =
    await getEventsSheet();

  const rows =
    await sheet.getRows();

  const eventRow =
    rows.find(
      (row) =>
        String(
          row.get(
            "event_id",
          ) ?? "",
        ) === eventId,
    );

  if (!eventRow) {
    throw new Error(
      "対象のイベントが見つかりません。",
    );
  }

  const formId =
    String(
      eventRow.get(
        "form_id",
      ) ?? "",
    );

  if (!formId) {
    throw new Error(
      "イベントにGoogleフォームIDが設定されていません。",
    );
  }

  /*
   * 先にGoogleフォームを更新する。
   * Google側で失敗した場合は、
   * Eventsシートは変更しない。
   */
  await synchronizeGoogleForm(
    formId,
  );

  eventRow.set(
    "status",
    status,
  );

  await eventRow.save();

  return mapEventRow(
    eventRow,
  );
}
