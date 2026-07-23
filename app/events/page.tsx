"use client";

import useSWR from "swr";
import EventCard from "../../components/EventCard";
import type { EventWithStatus } from "@/types/event";

const fetcher = async (url: string): Promise<EventWithStatus[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`); // 401/500 → error
  return res.json();
};

export default function EventsPage() {
  const { data: events, error, isLoading } = useSWR<EventWithStatus[]>("/api/events", fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 60000,
    dedupingInterval: 30000,
    focusThrottleInterval: 30000,
  });

  if (error) return <div>エラーが発生しました</div>;
  if (isLoading) return <div>読み込み中...</div>;
  if (!events?.length) return <div>予定されているイベントはありません。</div>;

  return (
    <main className="container">
      <h2>イベント案内一覧</h2>
      <div className="event-grid">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </main>
  );
}