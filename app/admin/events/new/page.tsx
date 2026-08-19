import Link from "next/link";
import { EventCreateForm } from "../eventCreateForm";

export default function NewEventPage() {
  return (
    <main>
      <div>
        <Link href="/admin/events">← イベント一覧へ戻る</Link>
      </div>

      <h1>イベント作成</h1>

      <EventCreateForm />
    </main>
  );
}
