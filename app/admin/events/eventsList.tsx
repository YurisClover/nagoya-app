"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  EventAudience,
  EventStatus,
  SheetEvent,
} from "@/lib/sheets/events";

type EventListProps = {
  events: SheetEvent[];
};

type UpdateStatusResult = {
  success: boolean;
  error?: string;
  detail?: string;
  event?: SheetEvent;
};

const STATUS_LABELS:
Record<EventStatus, string> = {
  private: "非公開",
  published: "公開中",
  closed: "受付終了",
};

const AUDIENCE_LABELS:
Record<EventAudience, string> = {
  general: "一般会員向け",
  executive: "執行部向け",
};

/**
 * 開始日時だけを表示する。
 *
 * 例：
 * 2026年8月15日(土) 16:00
 */
function formatEventDate(
  eventDate: string,
) {
  const date =
    new Date(eventDate);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return eventDate;
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      timeZone:
        "Asia/Tokyo",

      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).format(date);
}

/**
 * 開始日時と終了日時を表示する。
 *
 * 同じ日の場合：
 * 2026年8月15日(土) 16:00〜21:00
 *
 * 日をまたぐ場合：
 * 2026年8月15日(土) 22:00〜8月16日(日) 02:00
 */
function formatEventPeriod(
  eventDate: string,
  eventEndDate: string,
) {
  /*
   * 既存のテストデータなどで
   * 終了日時が空欄の場合は、
   * 開始日時だけを表示する。
   */
  if (!eventEndDate) {
    return formatEventDate(
      eventDate,
    );
  }

  const startDate =
    new Date(eventDate);

  const endDate =
    new Date(eventEndDate);

  if (
    Number.isNaN(
      startDate.getTime(),
    ) ||
    Number.isNaN(
      endDate.getTime(),
    )
  ) {
    return `${eventDate}〜${eventEndDate}`;
  }

  const fullDateFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",

        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      },
    );

  const shortDateFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",

        month: "long",
        day: "numeric",
        weekday: "short",
      },
    );

  const timeFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",

        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    );

  const dateKeyFormatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Tokyo",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );

  const startDateText =
    fullDateFormatter.format(
      startDate,
    );

  const startTimeText =
    timeFormatter.format(
      startDate,
    );

  const endTimeText =
    timeFormatter.format(
      endDate,
    );

  const isSameDay =
    dateKeyFormatter.format(
      startDate,
    ) ===
    dateKeyFormatter.format(
      endDate,
    );

  if (isSameDay) {
    return `${startDateText} ${startTimeText}〜${endTimeText}`;
  }

  const endDateText =
    shortDateFormatter.format(
      endDate,
    );

  return `${startDateText} ${startTimeText}〜${endDateText} ${endTimeText}`;
}

type EventStatusControlProps = {
  event: SheetEvent;
  updatingEventId: string | null;

  tryStartUpdate:
    (eventId: string) => boolean;

  finishUpdate:
    () => void;

  onUpdated:
    (event: SheetEvent) => void;
};

function EventStatusControl({
  event,
  updatingEventId,
  tryStartUpdate,
  finishUpdate,
  onUpdated,
}: EventStatusControlProps) {
  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState<EventStatus>(
    event.status,
  );

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const isUpdating =
    updatingEventId ===
    event.event_id;

  const isAnyUpdating =
    updatingEventId !== null;

  async function handleUpdate() {
    const started =
      tryStartUpdate(
        event.event_id,
      );

    if (!started) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    try {
      const response =
        await fetch(
          "/api/events/status",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              eventId:
                event.event_id,

              status:
                selectedStatus,
            }),
          },
        );

      const result =
        (await response.json()) as
          UpdateStatusResult;

      if (
        !response.ok ||
        !result.success
      ) {
        console.error(
          "状態変更APIエラー:",
          result,
        );

        const errorText = [
          result.error ??
            "公開状態の変更に失敗しました。",

          result.detail
            ? `詳細: ${result.detail}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        setErrorMessage(
          errorText,
        );

        return;
      }

      const updatedEvent:
      SheetEvent =
        result.event ?? {
          ...event,

          status:
            selectedStatus,
        };

      onUpdated(
        updatedEvent,
      );

      setSelectedStatus(
        updatedEvent.status,
      );

      setMessage(
        "GoogleフォームとEventsシートへ反映しました。",
      );
    } catch (error) {
      console.error(
        "Event status update error:",
        error,
      );

      const detail =
        error instanceof Error
          ? error.message
          : "不明な通信エラー";

      setErrorMessage(
        `公開状態の変更中に通信エラーが発生しました。\n詳細: ${detail}`,
      );
    } finally {
      finishUpdate();
    }
  }

  return (
    <div>
      <select
        value={selectedStatus}
        disabled={isAnyUpdating}
        onChange={(changeEvent) => {
          setSelectedStatus(
            changeEvent.target
              .value as
              EventStatus,
          );

          setMessage("");
          setErrorMessage("");
        }}
        aria-label={
          `${event.title}の公開状態`
        }
      >
        <option value="private">
          非公開
        </option>

        <option value="published">
          公開中
        </option>

        <option value="closed">
          受付終了
        </option>
      </select>

      <button
        type="button"
        disabled={isAnyUpdating}
        onClick={handleUpdate}
      >
        {isUpdating
          ? "反映しています..."
          : "状態を反映"}
      </button>

      {message && (
        <p role="status">
          {message}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          style={{
            whiteSpace:
              "pre-wrap",
          }}
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export function EventList({
  events,
}: EventListProps) {
  const [
    displayedEvents,
    setDisplayedEvents,
  ] = useState<SheetEvent[]>(
    events,
  );

  const [
    updatingEventId,
    setUpdatingEventId,
  ] = useState<string | null>(
    null,
  );

  /*
   * stateの反映前に別のボタンを
   * 素早く押された場合にも、
   * 二重実行を防ぐための即時ロック。
   */
  const updateLockRef =
    useRef(false);

  /*
   * イベント作成後などに、
   * page.tsxから新しい一覧が届いたら同期する。
   */
  useEffect(() => {
    setDisplayedEvents(
      events,
    );
  }, [events]);

  function tryStartUpdate(
    eventId: string,
  ): boolean {
    if (
      updateLockRef.current
    ) {
      return false;
    }

    updateLockRef.current =
      true;

    setUpdatingEventId(
      eventId,
    );

    return true;
  }

  function finishUpdate() {
    updateLockRef.current =
      false;

    setUpdatingEventId(
      null,
    );
  }

  function handleEventUpdated(
    updatedEvent: SheetEvent,
  ) {
    setDisplayedEvents(
      (currentEvents) =>
        currentEvents.map(
          (currentEvent) =>
            currentEvent.event_id ===
            updatedEvent.event_id
              ? updatedEvent
              : currentEvent,
        ),
    );
  }

  if (
    displayedEvents.length === 0
  ) {
    return (
      <section>
        <h2>
          作成済みイベント
        </h2>

        <p>
          作成済みのイベントはありません。
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2>
        作成済みイベント
      </h2>

      <p>
        公開状態を変更すると、GoogleフォームとEventsシートの両方に反映されます。
      </p>

      <div
        style={{
          overflowX: "auto",
        }}
      >
        <table>
          <thead>
            <tr>
              <th>
                イベント名
              </th>

              <th>
                開催日時
              </th>

              <th>
                開催場所
              </th>

              <th>
                対象者
              </th>

              <th>
                現在の状態
              </th>

              <th>
                申込数
              </th>

              <th>
                Googleフォーム
              </th>

              <th>
                状態変更
              </th>
            </tr>
          </thead>

          <tbody>
            {displayedEvents.map(
              (event) => {
                const formEditUrl =
                  `https://docs.google.com/forms/d/${event.form_id}/edit`;

                return (
                  <tr
                    key={
                      event.event_id
                    }
                  >

                    <td>
                      {event.title}
                    </td>

                    <td>
                      {formatEventPeriod(
                        event.event_date,
                        event.event_end_date,
                      )}
                    </td>

                    <td>
                      {event.location ||
                        "未設定"}
                    </td>

                    <td>
                      {
                        AUDIENCE_LABELS[
                          event.audience
                        ]
                      }
                    </td>

                    <td>
                      {
                        STATUS_LABELS[
                          event.status
                        ]
                      }
                    </td>

                    <td>
                      {
                        event.registration_count
                      }
                    </td>

                    <td>
                      <a
                        href={
                          formEditUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        編集
                      </a>

                      {" / "}

                      <a
                        href={
                          event.form_url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        回答画面
                      </a>
                    </td>

                    <td>
                      <EventStatusControl
                        event={event}
                        updatingEventId={
                          updatingEventId
                        }
                        tryStartUpdate={
                          tryStartUpdate
                        }
                        finishUpdate={
                          finishUpdate
                        }
                        onUpdated={
                          handleEventUpdated
                        }
                      />
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}