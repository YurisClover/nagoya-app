"use client";

import {useState,} from "react";
import useSWR from "swr";
import EventCard from "./EventCard";
import type {EventPosition,EventWithStatus,} from "@/types/event";

type EventsClientProps = {
  role?: string;
};

const fetcher = async (
  url: string,
): Promise<EventWithStatus[]> => {
  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `API error: ${response.status}`,
    );
  }

  return response.json();
};

export default function EventsClient({
  role,
}: EventsClientProps) {
  const canSwitchPosition =
    role === "executive" ||
    role === "admin";

  const [
    selectedPosition,
    setSelectedPosition,
  ] = useState<EventPosition>(
    "general",
  );

  /*
   * generalユーザーは、画面やURLを操作しても
   * 一般会員向けのみ取得する。
   */
  const position: EventPosition =
    canSwitchPosition
      ? selectedPosition
      : "general";

  const {
    data: events,
    error,
    isLoading,
  } = useSWR<EventWithStatus[]>(
    `/api/events?position=${position}`,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
      dedupingInterval: 30_000,
      focusThrottleInterval:
        30_000,
    },
  );

  return (
    <main className="container">
      <h2>
        イベント案内一覧
      </h2>

      {canSwitchPosition && (
        <div
          className="mb-5 flex gap-2"
          role="group"
          aria-label="イベント対象者"
        >
          <button
            type="button"
            aria-pressed={
              position === "general"
            }
            onClick={() =>
              setSelectedPosition(
                "general",
              )
            }
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              position === "general"
                ? "bg-[#1B3A5C] text-white"
                : "bg-[#E2E8F0] text-[#4A5568]"
            }`}
          >
            一般会員向け
          </button>

          <button
            type="button"
            aria-pressed={
              position ===
              "executive"
            }
            onClick={() =>
              setSelectedPosition(
                "executive",
              )
            }
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              position ===
              "executive"
                ? "bg-[#1B3A5C] text-white"
                : "bg-[#E2E8F0] text-[#4A5568]"
            }`}
          >
            執行部向け
          </button>
        </div>
      )}

      {error ? (
        <div>
          エラーが発生しました。
        </div>
      ) : isLoading ? (
        <div>
          読み込み中...
        </div>
      ) : !events?.length ? (
        <div>
          予定されているイベントはありません。
        </div>
      ) : (
        <div className="event-grid">
          {events.map(
            (event) => (
              <EventCard
                key={
                  event.event_id
                }
                event={event}
              />
            ),
          )}
        </div>
      )}
    </main>
  );
}