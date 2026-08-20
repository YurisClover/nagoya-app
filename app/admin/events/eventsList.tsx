"use client";
import { useRef, useState } from "react";
import { formatEventPeriod } from "@/lib/datetime";
import type {
  EventPosition,
  EventStatus,
  SheetEvent,
} from "@/lib/sheets/events";

type EventListProps = { events: SheetEvent[] };
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

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "準備中",
  published: "公開",
  closed: "受付終了",
};

const POSITION_LABELS: Record<EventPosition, string> = {
  general: "一般会員",
  executive: "執行部",
};

type EventDeleteControlProps = {
  event: SheetEvent;
  updatingEventId: string | null;
  tryStartUpdate: (eventId: string) => boolean;
  finishUpdate: () => void;
  onDeleted: (eventId: string) => void;
};

function EventDeleteControl({
  event,
  updatingEventId,
  tryStartUpdate,
  finishUpdate,
  onDeleted,
}: EventDeleteControlProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isAnyUpdating = updatingEventId !== null;

  async function handleDelete() {
    const confirmed = window.confirm(
      `「${event.title}」を削除しますか？\nGoogleフォームも非公開・受付停止になります。`,
    );
    if (!confirmed) {
      return;
    }
    const started = tryStartUpdate(event.event_id);
    if (!started) {
      return;
    }
    setIsDeleting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/events/delete", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.event_id }),
      });
      const result = (await response.json()) as DeleteEventResult;
      if (!response.ok || !result.success) {
        const errorText = [
          result.error ?? "イベントの削除に失敗しました。",
          result.detail ? `詳細: ${result.detail}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        setErrorMessage(errorText);
        return;
      }
      //削除成功時だけ一覧stateから対象イベントを除外する
      onDeleted(event.event_id);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "不明な通信エラー";
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
      <button className="btn btn-danger px-3 py-1.5 text-xs disabled:opacity-50" type="button" disabled={isAnyUpdating} onClick={handleDelete}>
        {isDeleting ? "削除しています..." : "削除"}
      </button>

      {errorMessage && (
        <p
          role="alert"
          style={{
            whiteSpace: "pre-wrap",
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
  tryStartUpdate: (eventId: string) => boolean;
  finishUpdate: () => void;
  onUpdated: (event: SheetEvent) => void;
};

function EventPositionControl({
  event,
  updatingEventId,
  tryStartUpdate,
  finishUpdate,
  onUpdated,
}: EventPositionControlProps) {
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const isUpdating = updatingEventId === event.event_id;
  const isAnyUpdating = updatingEventId !== null;

  async function handleUpdate(nextPosition: EventPosition) {
    if (nextPosition === event.position) {
      setMessage("対象者は変更されていません。");
      setErrorMessage("");
      return;
    }

    const started = tryStartUpdate(event.event_id);

    if (!started) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/events/position", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.event_id,
          position: nextPosition,
        }),
      });

      const result = (await response.json()) as UpdatePositionResult;

      if (!response.ok || !result.success) {
        const errorText = [
          result.error ?? "対象者の変更に失敗しました。",
          result.detail ? `詳細: ${result.detail}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        setErrorMessage(errorText);

        return;
      }

      const updatedEvent = result.event ?? {
        ...event,
        position: nextPosition,
      };

      onUpdated(updatedEvent);
      setMessage("イベント対象者を変更しました。");
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "不明な通信エラー";
      setErrorMessage(
        `対象者の変更中に通信エラーが発生しました。\n詳細: ${detail}`,
      );
    } finally {
      finishUpdate();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5" role="group" aria-label={`${event.title}の対象者`}>
          {(["general", "executive"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={isAnyUpdating || value === event.position}
              onClick={() => handleUpdate(value)}
              aria-pressed={value === event.position}
              className={`rounded-control px-3 py-1.5 text-xs font-bold transition ${
                value === event.position
                  ? "bg-brand text-white"
                  : "bg-surface-muted text-ink-muted hover:bg-line disabled:opacity-50"
              }`}
            >
              {POSITION_LABELS[value]}
            </button>
          ))}
        </div>
        {isUpdating && <span className="text-meta">反映中...</span>}
      </div>

      {message && <p role="status" className="mt-2 text-xs text-ink-muted">{message}</p>}
      {errorMessage && (
        <p role="alert" className="mt-2 whitespace-pre-wrap text-xs text-danger" >
          {errorMessage}
        </p>
      )}
    </div>
  );
}

type EventStatusControlProps = {
  event: SheetEvent;
  updatingEventId: string | null;
  tryStartUpdate: (eventId: string) => boolean;
  finishUpdate: () => void;
  onUpdated: (event: SheetEvent) => void;
};

function EventStatusControl({
  event,
  updatingEventId,
  tryStartUpdate,
  finishUpdate,
  onUpdated,
}: EventStatusControlProps) {
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const isUpdating = updatingEventId === event.event_id;
  const isAnyUpdating = updatingEventId !== null;

  async function handleUpdate(nextStatus: EventStatus) {
    const started = tryStartUpdate(event.event_id);

    if (!started) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/events/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.event_id,
          status: nextStatus,
        }),
      });

      const result = (await response.json()) as UpdateStatusResult;

      if (!response.ok || !result.success) {
        console.error("状態変更APIエラー:", result);
        const errorText = [
          result.error ?? "公開状態の変更に失敗しました。",
          result.detail ? `詳細: ${result.detail}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        setErrorMessage(errorText);

        return;
      }

      const updatedEvent: SheetEvent = result.event ?? {
        ...event,
        status: nextStatus,
      };

      onUpdated(updatedEvent);
      setMessage("GoogleフォームとEventsシートへ反映しました。");
    } catch (error) {
      console.error("Event status update error:", error);

      const detail =
        error instanceof Error ? error.message : "不明な通信エラー";
      setErrorMessage(
        `公開状態の変更中に通信エラーが発生しました。\n詳細: ${detail}`,
      );
    } finally {
      finishUpdate();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5" role="group" aria-label={`${event.title}のステータス`}>
          {(["published", "closed", "draft"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={isAnyUpdating || value === event.status}
              onClick={() => handleUpdate(value)}
              aria-pressed={value === event.status}
              className={`rounded-control px-3 py-1.5 text-xs font-bold transition ${
                value === event.status
                  ? "bg-brand text-white"
                  : "bg-surface-muted text-ink-muted hover:bg-line disabled:opacity-50"
              }`}
            >
              {STATUS_LABELS[value]}
            </button>
          ))}
        </div>
        {isUpdating && <span className="text-meta">反映中...</span>}
      </div>
      {message && <p role="status" className="mt-2 text-xs text-ink-muted">{message}</p>}
      {errorMessage && (
        <p role="alert" className="mt-2 whitespace-pre-wrap text-xs text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export function EventList({ events }: EventListProps) {
  const [displayedEvents, setDisplayedEvents] = useState<SheetEvent[]>(events);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  /*
   * stateの反映前に別のボタンを
   * 素早く押された場合にも、
   * 二重実行を防ぐための即時ロック。
   */
  const updateLockRef = useRef(false);
  /*
   * イベント作成後などに、
   * page.tsxから新しい一覧が届いたら同期する。
   */
  const [prevEvents, setPrevEvents] = useState(events);
  if (prevEvents !== events) {
    setPrevEvents(events);
    setDisplayedEvents(events);
  }

  function tryStartUpdate(eventId: string): boolean {
    if (updateLockRef.current) {
      return false;
    }
    updateLockRef.current = true;
    setUpdatingEventId(eventId);

    return true;
  }

  function finishUpdate() {
    updateLockRef.current = false;
    setUpdatingEventId(null);
  }

  function handleEventUpdated(updatedEvent: SheetEvent) {
    setDisplayedEvents((currentEvents) =>
      currentEvents.map((currentEvent) =>
        currentEvent.event_id === updatedEvent.event_id
          ? updatedEvent
          : currentEvent,
      ),
    );
  }

  function handleEventDeleted(eventId: string) {
    setDisplayedEvents((currentEvents) =>
      currentEvents.filter((currentEvent) => currentEvent.event_id !== eventId),
    );
  }

  if (displayedEvents.length === 0) {
    return (
      <section>
        <h2>作成済みイベント</h2>

        <p>作成済みのイベントはありません。</p>
      </section>
    );
  }

  return (
    <section>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {displayedEvents.map((event) => {
          const formEditUrl = `https://docs.google.com/forms/d/${event.form_id}/edit`;

          const responseSpreadsheetId =
            process.env.NEXT_PUBLIC_EVENT_RESPONSE_SPREADSHEET_ID ?? "";

          const responseSheetUrl =
            responseSpreadsheetId && event.response_sheet_id
              ? `https://docs.google.com/spreadsheets/d/${responseSpreadsheetId}/edit#gid=${event.response_sheet_id}`
              : "";

          return (
            <article
              key={event.event_id}
              className="card transition hover:shadow-md"
            >
              {/* イベント名・状態 */}
              <div className="border-b border-line pb-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold">
                    {event.title}
                  </h2>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      event.status === "published"
                        ? "bg-blue-100 text-blue-800"
                        : event.status === "closed"
                          ? "bg-slate-200"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {STATUS_LABELS[event.status]}
                  </span>
                </div>

                <p className="mt-2 text-sm text-ink-muted">
                  {formatEventPeriod(event.event_date, event.event_end_date)}
                </p>

                <p className="mt-1 text-sm text-ink-muted">
                  開催場所：
                  <span className="font-medium">
                    {event.location || "未設定"}
                  </span>
                </p>
              </div>

              {/* 対象者・申込数 */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-muted p-3">
                  <p className="mb-2 text-xs font-medium text-ink-muted">
                    対象者
                  </p>

                  <EventPositionControl
                    event={event}
                    updatingEventId={updatingEventId}
                    tryStartUpdate={tryStartUpdate}
                    finishUpdate={finishUpdate}
                    onUpdated={handleEventUpdated}
                  />
                </div>

                <div className="rounded-lg bg-surface-muted p-3">
                  <p className="text-xs font-medium text-ink-muted">申込数</p>

                  <p className="mt-1 text-xl font-bold">
                    {event.registration_count}
                    <span className="ml-1 text-sm font-normal text-ink-muted">
                      名
                    </span>
                  </p>
                </div>
              </div>

              {/* Googleフォーム・回答一覧 */}
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  フォーム・回答
                </p>

                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <a
                    href={formEditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand hover:underline"
                  >
                    フォーム編集
                  </a>

                  <a
                    href={event.form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand hover:underline"
                  >
                    回答画面
                  </a>

                  {responseSheetUrl ? (
                    <a
                      href={responseSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand hover:underline"
                    >
                      回答一覧を開く
                    </a>
                  ) : (
                    <span className="text-ink-muted">回答一覧なし</span>
                  )}
                </div>
              </div>

              {/* 状態変更・削除 */}
              <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink-muted">
                    公開状態
                  </p>

                  <EventStatusControl
                    event={event}
                    updatingEventId={updatingEventId}
                    tryStartUpdate={tryStartUpdate}
                    finishUpdate={finishUpdate}
                    onUpdated={handleEventUpdated}
                  />
                </div>

                <EventDeleteControl
                  event={event}
                  updatingEventId={updatingEventId}
                  tryStartUpdate={tryStartUpdate}
                  finishUpdate={finishUpdate}
                  onDeleted={handleEventDeleted}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
