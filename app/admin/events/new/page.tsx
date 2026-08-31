import Link from "next/link";
import { EventCreateForm } from "../eventCreateForm";

export default function NewEventPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h1 className="text-2xl font-bold">イベント作成</h1>
        <Link
          href="/admin/events"
          className="btn btn-secondary px-4 py-2 text-sm"
        >
          一覧に戻る
        </Link>
      </div>

      <EventCreateForm />
    </main>
  );
}
