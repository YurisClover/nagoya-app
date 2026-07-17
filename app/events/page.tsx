import { getEventsData } from "@/lib/events";
import { auth } from "@/auth";
import EventCard from "../../components/EventCard";

export default async function EventsPage() {
  const session = await auth();

  // セッションがあれば名前を渡す
  const events = await getEventsData(session?.user?.name || undefined);

  return (
    <main className="container">
      <h2>イベント案内一覧</h2>
      <div className="event-grid">
        {events.map((event, index) => (
          // コンポーネントに event オブジェクトをまるごと渡す
          <EventCard key={event.id ?? index} event={event} />
        ))}
      </div>
    </main>
  );
}