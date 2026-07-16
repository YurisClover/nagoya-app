// app/events/page.tsx

// 1. 型定義はここに書くか、別ファイルからインポート
interface EventItem {
  id: number | null;
  title: string;
  event_date: string;
  form_url: string;
}

// 2. ページコンポーネント (※ここがexport defaultである必要があります)
export default async function EventsPage() {
  // サーバーサイドでデータを取得
  const res = await fetch("http://localhost:3000/api/events", { cache: "no-store" });
  const events: EventItem[] = await res.json();

  return (
    <main className="container">
      <h2>イベント案内一覧</h2>
      <div className="event-grid">
        {events.map((event, index) => (
          <div key={event.id ?? index} className="event-card">
            <div className="event-title">{event.title}</div>
            <p className="event-date">{event.event_date}</p>
          </div>
        ))}
      </div>
    </main>
  );
}