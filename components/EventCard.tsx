'use client';
import { useEvents } from '@/hooks/useEvents'; // 作成したフックをインポート
import EventCard from '@/components/EventCard'; // 作成したコンポーネントをインポート

export default function Home() {
  const { events, isLoading, isError } = useEvents();

  if (isLoading) return <p>読み込み中...</p>;
  if (isError) return <div className="error-msg">通信エラーが発生しました。</div>;

  return (
    <main className="container">
      <h2>イベント案内一覧</h2>
      <div className="event-grid">
        {events.length === 0 ? (
          <p>現在、案内中の一覧はありません。</p>
        ) : (
          events.map((event: any, index: number) => (
            <EventCard key={event.id ?? index} event={event} />
          ))
        )}
      </div>
    </main>
  );
}