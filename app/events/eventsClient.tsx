"use client";

import { useState } from "react";
import useSWR from "swr";
import EventCard from "./EventCard";
import type { EventPosition, EventWithStatus } from "@/types/event";

const PAGE_SIZE = 10;

const fetcher = async (url: string): Promise<EventWithStatus[]> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export default function EventsClient({ role }: { role?: string }) {
  // executive/admin switch event page
  const canSwitchPosition = role === "executive" || role === "admin";
  const [selectedPosition, setSelectedPosition] = useState<EventPosition>("general");
  const [page, setPage] = useState(1);
  const position = canSwitchPosition ? selectedPosition : "general";

  const { data: events, error, isLoading } = useSWR<EventWithStatus[]>(
    `/api/events?position=${position}`,
    fetcher,
    { revalidateOnFocus: true }
  );

  const list = events ?? [];
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages); // shorter list (SWR refresh)
  const pageItems = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="page-container">
      <h1 className="mb-4 text-lg font-bold">イベント一覧</h1>

      {canSwitchPosition && (
        <div className="mb-4 flex gap-2">
          {(
            [
              ["general", "一般会員向け"],
              ["executive", "執行部向け"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={position === value}
              onClick={() => {
                setSelectedPosition(value);
                setPage(1); // switch set page to 1
              }}
              className={`rounded-control px-4 py-2 text-sm font-bold transition ${
                position === value
                  ? "bg-brand text-white"
                  : "bg-surface-muted text-ink-muted hover:bg-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <div className="card text-center">
          <p className="text-sm text-danger">イベント情報を取得できませんでした。</p>
          <p className="text-meta mt-1">時間をおいて再度お試しください。</p>
        </div>
      ) : isLoading ? (
        <p className="text-meta py-6 text-center">読み込み中...</p>
      ) : list.length === 0 ? (
        <p className="text-meta py-6 text-center">予定されているイベントはありません。</p>
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((event) => (
              <EventCard key={event.event_id} event={event} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-xs">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="btn btn-secondary px-3 py-1 text-xs disabled:opacity-50"
              >
                前へ
              </button>
              <span className="text-ink-muted">
                {currentPage} / {totalPages} ページ
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="btn btn-secondary px-3 py-1 text-xs disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}