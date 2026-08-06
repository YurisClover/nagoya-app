"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  formatEventPeriod, 
}from "@/lib/datetime";

import type {
  EventPosition,
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

type UpdatePositionResult = {
  success: boolean;
  error?: string;
  detail?: string;
  event?: SheetEvent;
};

type DeleteEventResult = {
  success: boolean;
  error?: string;
  detail?: string;
  event?: SheetEvent;
};

const STATUS_LABELS:
Record<EventStatus, string> = {
  draft: "準備中",
  published: "公開",
  closed: "受付終了",
};

const POSITION_LABELS:
Record<EventPosition, string> = {
  general: "一般会員向け",
  executive: "執行部向け",
};

type EventDeleteControlProps = {
  event: SheetEvent;
  updatingEventId:
    string | null;

  tryStartUpdate:
    (eventId: string) => boolean;

  finishUpdate:
    () => void;

  onDeleted:
    (eventId: string) => void;
};

function EventDeleteControl({
  event,
  updatingEventId,
  tryStartUpdate,
  finishUpdate,
  onDeleted,
}: EventDeleteControlProps) {
  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const isAnyUpdating =
    updatingEventId !== null;

  async function handleDelete() {
    const confirmed =
      window.confirm(
        `「${event.title}」を削除しますか？\nGoogleフォームも非公開・受付停止になります。`,
      );

    if (!confirmed) {
      return;
    }

    const started =
      tryStartUpdate(
        event.event_id,
      );

    if (!started) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          "/api/events/delete",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              eventId:
                event.event_id,
            }),
          },
        );

      const result =
        (await response.json()) as
          DeleteEventResult;

      if (
        !response.ok ||
        !result.success
      ) {
        const errorText = [
          result.error ??
            "イベントの削除に失敗しました。",

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

      /*
       * 削除成功時だけ、
       * 一覧stateから対象イベントを除外する。
       */
      onDeleted(
        event.event_id,
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "不明な通信エラー";

      setErrorMessage(
        `イベント削除中に通信エラーが発生しました。\n詳細: ${detail}`,
      );
    } finally {
      setIsDeleting(false);
      finishUpdate();
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={
          isAnyUpdating
        }
        onClick={
          handleDelete
        }
      >
        {isDeleting
          ? "削除しています..."
          : "削除"}
      </button>

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

type EventPositionControlProps = {
  event: SheetEvent;
  updatingEventId: string | null;

  tryStartUpdate:
    (eventId: string) => boolean;

  finishUpdate:
    () => void;

  onUpdated:
    (event: SheetEvent) => void;
};

function EventPositionControl({
  event,
  updatingEventId,
  tryStartUpdate,
  finishUpdate,
  onUpdated,
}: EventPositionControlProps) {
  const [
    selectedPosition,
    setSelectedPosition,
  ] = useState<EventPosition>(
    event.position,
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

  useEffect(() => {
    setSelectedPosition(
      event.position,
    );
  }, [event.position]);

  async function handleUpdate() {
    if (
      selectedPosition ===
      event.position
    ) {
      setMessage(
        "対象者は変更されていません。",
      );

      setErrorMessage("");

      return;
    }

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
          "/api/events/position",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              eventId:
                event.event_id,

              position:
                selectedPosition,
            }),
          },
        );

      const result =
        (await response.json()) as
          UpdatePositionResult;

      if (
        !response.ok ||
        !result.success
      ) {
        const errorText = [
          result.error ??
            "対象者の変更に失敗しました。",

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

      const updatedEvent =
        result.event ?? {
          ...event,
          position:
            selectedPosition,
        };

      onUpdated(
        updatedEvent,
      );

      setSelectedPosition(
        updatedEvent.position,
      );

      setMessage(
        "イベント対象者を変更しました。",
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "不明な通信エラー";

      setErrorMessage(
        `対象者の変更中に通信エラーが発生しました。\n詳細: ${detail}`,
      );
    } finally {
      finishUpdate();
    }
  }

  return (
    <div>
      <p>
        {
          POSITION_LABELS[
            event.position
          ]
        }
      </p>

      <select
        value={
          selectedPosition
        }
        disabled={
          isAnyUpdating
        }
        onChange={(
          changeEvent,
        ) => {
          setSelectedPosition(
            changeEvent.target
              .value as
              EventPosition,
          );

          setMessage("");
          setErrorMessage("");
        }}
        aria-label={
          `${event.title}の対象者`
        }
      >
        <option value="general">
          一般会員向け
        </option>

        <option value="executive">
          執行部向け
        </option>
      </select>

      <button
        type="button"
        disabled={
          isAnyUpdating
        }
        onClick={
          handleUpdate
        }
      >
        {isUpdating
          ? "反映しています..."
          : "対象者を反映"}
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
        <option value="draft">
          準備中
        </option>

        <option value="published">
          公開
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

  function handleEventDeleted(
  eventId: string,
) {
  setDisplayedEvents(
    (currentEvents) =>
      currentEvents.filter(
        (currentEvent) =>
          currentEvent.event_id !==
          eventId,
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

      <p role="note">公開状態はGoogleフォーム側で直接変更せず、この管理画面から変更してください</p>

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

              <th>削除</th>
            </tr>
          </thead>

          <tbody>
            {displayedEvents.map(
              (event) => {
                const formEditUrl =
                  `https://docs.google.com/forms/d/${event.form_id}/edit`;
                  const responseSpreadsheetId =
                 process.env
                  .NEXT_PUBLIC_EVENT_RESPONSE_SPREADSHEET_ID ??
                       "";

const responseSheetUrl =
  responseSpreadsheetId &&
  event.response_sheet_id
    ? `https://docs.google.com/spreadsheets/d/${responseSpreadsheetId}/edit#gid=${event.response_sheet_id}`
    : "";

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
                      <EventPositionControl
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

  {" / "}

  {responseSheetUrl ? (
    <a
      href={
        responseSheetUrl
      }
      target="_blank"
      rel="noopener noreferrer"
    >
      回答一覧を開く
    </a>
  ) : (
    <span>
      回答一覧なし
    </span>
  )}
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
                    <td>
  <EventDeleteControl
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
    onDeleted={
      handleEventDeleted
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