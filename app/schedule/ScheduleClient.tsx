"use client";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import type { EventPosition } from "@/types/event";
import Link from "next/link";

type ViewMode = "calendar" | "list";
type CalendarEventItem = {
  googleEventId: string;
  eventId: string;
  title: string;
  start: string;
  end: string;
  location: string;
  position: EventPosition;
};
type CalendarApiResponse = {
  success: true;
  year: number;
  month: number;
  position: EventPosition;
  canViewExecutive: boolean;
  events: CalendarEventItem[];
};
type CalendarApiError = { success: false; error?: string };
type ScheduleClientProps = { role?: string };

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const yearMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
});
const dateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((part) => part.type === type)?.value ?? "";
}
function getCurrentJstYearMonth() {
  const parts = yearMonthFormatter.formatToParts(new Date());
  return {
    year: Number(getPart(parts, "year")),
    month: Number(getPart(parts, "month")),
  };
}
function getJstDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = dateKeyFormatter.formatToParts(date);
  return [
    getPart(parts, "year"),
    getPart(parts, "month"),
    getPart(parts, "day"),
  ].join("-");
}
function createDateKey(year: number, month: number, day: number) {
  return [
    String(year),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function addDaysToDateKey(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);

  const nextDate = new Date(Date.UTC(year, month - 1, day + amount));

  return createDateKey(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
  );
}

function getEventDateKeys(start: string, end: string) {
  const startKey = getJstDateKey(start);
  let endKey = getJstDateKey(end);

  /*
   * 終了が翌日0:00ちょうどの場合、
   * その日は予定に含めない。
   */
  if (
    startKey !== endKey &&
    new Date(end).getTime() === new Date(`${endKey}T00:00:00+09:00`).getTime()
  ) {
    endKey = addDaysToDateKey(endKey, -1);
  }

  const dateKeys: string[] = [];
  let currentKey = startKey;

  while (currentKey <= endKey && dateKeys.length < 367) {
    dateKeys.push(currentKey);
    currentKey = addDaysToDateKey(currentKey, 1);
  }
  return dateKeys.length > 0 ? dateKeys : [startKey];
}

function getDateInformation(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    month,
    day,
    weekday: WEEKDAYS[weekdayIndex],
  };
}
function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}

function formatDateTime(value: string) {
  const date = getDateInformation(getJstDateKey(value));

  return `${date.month}/${date.day}(${date.weekday})${formatTime(value)}`;
}

function formatEventTimeRange(start: string, end: string) {
  if (getJstDateKey(start) === getJstDateKey(end)) {
    return `${formatTime(start)}〜${formatTime(end)}`;
  }
  return `${formatDateTime(start)}〜${formatDateTime(end)}`;
}

function getEventColor(position: EventPosition) {
  return position === "executive" ? "bg-[#7C3AED]" : "bg-[#2563EB]";
}
function getEventBadgeColor(position: EventPosition) {
  return position === "executive"
    ? "bg-[#EDE9FE] text-[#6D28D9]"
    : "bg-[#DBEAFE] text-[#1D4ED8]";
}

async function fetcher(url: string): Promise<CalendarApiResponse> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as
    CalendarApiResponse | CalendarApiError;
  if (!response.ok || !data.success) {
    throw new Error(
      !data.success && data.error
        ? data.error
        : "カレンダー情報を取得できませんでした。",
    );
  }
  return data;
}
export default function ScheduleClient({ role }: ScheduleClientProps) {
  const canSwitchPosition = role === "executive" || role === "admin";
  const [displayedMonth, setDisplayedMonth] = useState(getCurrentJstYearMonth);
  const [selectedPosition, setSelectedPosition] =
    useState<EventPosition>("general");
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const position: EventPosition = canSwitchPosition
    ? selectedPosition
    : "general";
  const { data, error, isLoading } = useSWR<CalendarApiResponse>(
    `/api/calendar?year=${displayedMonth.year}&month=${displayedMonth.month}&position=${position}`,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
      dedupingInterval: 1_000,
    },
  );
  const events = data?.events ?? [];
  const eventsByDate = new Map<string, CalendarEventItem[]>();
  for (const event of events) {
    for (const dateKey of getEventDateKeys(event.start, event.end)) {
      const dateEvents = eventsByDate.get(dateKey) ?? [];
      dateEvents.push(event);
      eventsByDate.set(dateKey, dateEvents);
    }
  }
  const selectedEvents = selectedDate
    ? (eventsByDate.get(selectedDate) ?? [])
    : [];
  const firstWeekday = new Date(
    Date.UTC(displayedMonth.year, displayedMonth.month - 1, 1),
  ).getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(displayedMonth.year, displayedMonth.month, 0),
  ).getUTCDate();
  const calendarCells: Array<number | null> = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    calendarCells.push(day);
  }
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }
  const todayKey = getJstDateKey(new Date());
  function changeMonth(amount: number) {
    setDisplayedMonth((current) => {
      const nextDate = new Date(
        Date.UTC(current.year, current.month - 1 + amount, 1),
      );
      return {
        year: nextDate.getUTCFullYear(),
        month: nextDate.getUTCMonth() + 1,
      };
    });
    setSelectedDate(null);
  }
  function changePosition(nextPosition: EventPosition) {
    setSelectedPosition(nextPosition);
    setSelectedDate(null);
  }

  return (
    <main className="container">
      <section className="mx-auto w-full max-w-xl pb-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="前の月"
              onClick={() => changeMonth(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand bg-white text-brand"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="min-w-[82px] text-center">
              <p className="text-xs text-ink-muted">{displayedMonth.year} 年</p>

              <h2 className="text-xl font-bold text-brand">
                {displayedMonth.month} 月
              </h2>
            </div>

            <button
              type="button"
              aria-label="次の月"
              onClick={() => changeMonth(1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand bg-white text-brand"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex gap-1" role="group" aria-label="表示形式">
            <button
              type="button"
              aria-pressed={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1 rounded-lg border border-brand px-3 py-2 text-xs font-bold ${
                viewMode === "calendar"
                  ? "bg-brand text-white"
                  : "bg-white text-brand"
              }`}
            >
              <CalendarDays size={15} />
              カレンダー
            </button>

            <button
              type="button"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 rounded-lg border border-brand px-3 py-2 text-xs font-bold ${
                viewMode === "list"
                  ? "bg-brand text-white"
                  : "bg-white text-brand"
              }`}
            >
              <ListIcon size={15} />
              リスト
            </button>
          </div>
        </div>

        {canSwitchPosition && (
          <div
            className="mb-4 grid grid-cols-2 gap-2"
            role="group"
            aria-label="カレンダー種別"
          >
            <button
              type="button"
              aria-pressed={position === "general"}
              onClick={() => changePosition("general")}
              className={`rounded-lg border border-brand py-2 text-sm font-bold ${
                position === "general"
                  ? "bg-brand text-white"
                  : "bg-white text-brand"
              }`}
            >
              一般
            </button>

            <button
              type="button"
              aria-pressed={position === "executive"}
              onClick={() => changePosition("executive")}
              className={`rounded-lg border border-brand py-2 text-sm font-bold ${
                position === "executive"
                  ? "bg-brand text-white"
                  : "bg-white text-brand"
              }`}
            >
              執行部
            </button>
          </div>
        )}

        {isLoading && (
          <div className="rounded-card border border-line bg-surface p-8 text-center text-sm text-ink-muted">
            読み込み中…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger bg-surface p-4 text-sm text-danger">
            {error instanceof Error
              ? error.message
              : "カレンダー情報を取得できませんでした。"}
          </div>
        )}
        {!isLoading && !error && viewMode === "calendar" && (
          <>
            <div className="overflow-hidden rounded-xl border border-brand bg-white">
              <div className="grid grid-cols-7 border-b border-brand bg-surface-muted">
                {WEEKDAYS.map((weekday, index) => (
                  <div
                    key={weekday}
                    className={`py-2 text-center text-xs font-bold ${
                      index === 0
                        ? "text-red-500"
                        : index === 6
                          ? "text-blue-500"
                          : "text-ink-muted"
                    }`}
                  >
                    {weekday}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarCells.map((day, index) => {
                  const isRightEdge = (index + 1) % 7 === 0;
                  const isBottomEdge = index >= calendarCells.length - 7;
                  const cellBorderClass = `border-brand ${isRightEdge ? "" : "border-r"} ${
                    isBottomEdge ? "" : "border-b"
                  }`;
                  if (day === null) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className={`min-h-[70px] bg-surface-muted ${cellBorderClass}`}
                      />
                    );
                  }

                  const dateKey = createDateKey(
                    displayedMonth.year,
                    displayedMonth.month,
                    day,
                  );
                  const dateEvents = eventsByDate.get(dateKey) ?? [];
                  const isSelected = selectedDate === dateKey;
                  const isToday = todayKey === dateKey;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDate(dateKey)}
                      className={`min-h-[70px] overflow-hidden p-1 text-left ${cellBorderClass} ${
                        isSelected
                          ? "bg-[#EAF0F6] ring-2 ring-inset ring-brand"
                          : "bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          isToday
                            ? "bg-brand font-bold text-white"
                            : "text-ink-muted"
                        }`}
                      >
                        {day}
                      </span>

                      <div className="mt-0.5 space-y-0.5">
                        {dateEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.googleEventId || event.eventId}
                            className={`truncate rounded px-1 py-0.5 text-[9px] leading-tight text-white ${getEventColor(
                              event.position,
                            )}`}
                          >
                            {event.title}
                          </div>
                        ))}

                        {dateEvents.length > 2 && (
                          <p className="px-1 text-[9px] text-ink-muted">
                            {" "}
                            ＋ {dateEvents.length - 2} 件
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-brand bg-white p-4">
              {!selectedDate ? (
                <>
                  <p className="font-bold text-brand">
                    {" "}
                    日付をタップして予定を確認{" "}
                  </p>
                  <p className="py-5 text-center text-ink-muted"> ― </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-brand">
                    {getDateInformation(selectedDate).month} 月
                    {getDateInformation(selectedDate).day} 日（{" "}
                    {getDateInformation(selectedDate).weekday}）の予定
                  </p>

                  {selectedEvents.length === 0 ? (
                    <p className="py-5 text-center text-sm text-ink-muted">
                      {" "}
                      予定はありません{" "}
                    </p>
                  ) : (
                    <div className="mt-2 divide-y">
                      {selectedEvents.map((event) => (
                        <div
                          key={event.googleEventId || event.eventId}
                          className="flex items-start gap-2 py-3"
                        >
                          <span
                            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${getEventColor(event.position)}`}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-bold">
                                {event.eventId ? (
                                <Link
                                  href={`/events/form/${event.eventId}`}
                                  className="font-bold hover:text-brand hover:underline"
                                >
                                  { event.title }
                                </Link>
                                ) : (
                                  <p className="font-bold">{ event.title }</p>
                                )}
                              </p>

                              <p className="shrink-0 text-sm">
                                {formatEventTimeRange(event.start, event.end)}
                              </p>
                            </div>
                            {event.location && (
                              <p className="mt-1 text-xs text-ink-muted">
                                {" "}
                                {event.location}{" "}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {!isLoading && !error && viewMode === "list" && (
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {events.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-muted">
                {" "}
                予定はありません{" "}
              </p>
            ) : (
              <div className="divide-y">
                {events.map((event) => {
                  const date = getDateInformation(getJstDateKey(event.start));
                  return (
                    <article
                      key={event.googleEventId || event.eventId}
                      className="grid grid-cols-[68px_minmax(0,1fr)] gap-3 p-4"
                    >
                      <div className="text-center">
                        <p className="text-3xl font-bold leading-none text-brand">
                          {date.day}
                        </p>

                        <p className="mt-1 text-xs text-ink-muted">
                          {date.month} 月・ {date.weekday}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold">
                            {event.eventId ? (
                                <Link
                                  href={`/events/form/${event.eventId}`}
                                  className="font-bold hover:text-brand hover:underline"
                                >
                                  { event.title }
                                </Link>
                                ) : (
                                  <p className="font-bold">{ event.title }</p>
                                )}
                        </p>

                        <p className="mt-1 text-sm">
                          {formatEventTimeRange(event.start, event.end)}
                        </p>

                        {event.location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                            <MapPin size={13} className="shrink-0" />
                            {event.location}
                          </p>
                        )}

                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${getEventBadgeColor(
                            event.position,
                          )}`}
                        >
                          {event.position === "executive" ? "執行部" : "一般"}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
