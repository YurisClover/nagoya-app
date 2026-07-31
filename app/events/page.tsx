"use client";

import useSWR from "swr";
import EventCard from "./EventCard";
import type { EventWithStatus } from "@/types/event";

const fetcher = async (url: string): Promise<EventWithStatus[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export default function EventsPage() {
  const { data: events, error, isLoading } = useSWR<EventWithStatus[]>("/api/events", fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 60000,
    dedupingInterval: 30000,
    focusThrottleInterval: 30000,
  });

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-lg font-bold">イベント案内一覧</h1>

      {error ? (
        <div className="card text-center">
          <p className="text-sm text-danger">イベント情報を取得できませんでした。</p>
          <p className="text-meta mt-1">時間をおいて再度お試しください。</p>
        </div>
      ) : isLoading ? (
        <p className="text-meta py-6 text-center">読み込み中...</p>
      ) : !events?.length ? (
        <p className="text-meta py-6 text-center">予定されているイベントはありません。</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}