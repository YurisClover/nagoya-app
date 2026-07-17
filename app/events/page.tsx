"use client"; // クライアントコンポーネントにする

import useSWR from "swr";
import EventCard from "../../components/EventCard";

// APIを叩くためのfetcher関数
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EventsPage() {
  // SWRでデータを取得。ウィンドウに戻った時や10秒ごとに自動更新
  const { data: events, error, isLoading } = useSWR("/api/events", fetcher, {
    revalidateOnFocus: true, // ブラウザに戻ってきたら自動再取得
    refreshInterval: 10000,  // 10秒ごとに自動更新
  });

  if (error) return <div>エラーが発生しました</div>;
  if (isLoading) return <div>読み込み中...</div>;

  return (
    <main className="container">
      <h2>イベント案内一覧</h2>
      <div className="event-grid">
        {events.map((event: any, index: number) => (
          <EventCard key={event.id ?? index} event={event} />
        ))}
      </div>
    </main>
  );
}