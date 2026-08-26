import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEventsFromSheet } from "@/lib/sheets/events";
import { isEventFinished } from "@/lib/event-order";
import { nowJST } from "@/lib/datetime";
import { getCalendarRecords, type CalendarSyncStatus,} from "@/lib/sheets/calendar";
import Link from "next/link";
import { EventList } from "./eventsList";
import SyncEventResponsesButton from "@/components/SyncEventResponsesButton";

export default async function EventsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;

  if (role !== "admin" && role !== "executive") {
    redirect("/admin");
  }

  const [events, calendarRecords] = await Promise.all([ getEventsFromSheet(), getCalendarRecords(), ]);

  // "Finished" is decided HERE (server, JST via isEventFinished) and passed
  // down as data. Client-side new Date() runs in the viewer's timezone, so
  // computing this in the browser would flip cards on the wrong day for
  // anyone outside Japan. Same definition the member side uses to hide
  // finished events (lib/event-order.ts).
  const todayJst = nowJST().slice(0, 10);
  const finishedEventIds = events
    .filter((event) => isEventFinished(event, todayJst))
    .map((event) => event.event_id);
  const calendarSyncStatuses: Record< string, CalendarSyncStatus > = {};
  for (const record of calendarRecords) {
    const hasCalendarEvent = Boolean( record.google_calendar_event_id && record.google_calendar_id, );
    if ( record.calendar_sync_status === "synced" && hasCalendarEvent ) {
      calendarSyncStatuses[record.event_id] = "synced";
    } else if (
      record.calendar_sync_status === "error"
    ) {
      calendarSyncStatuses[record.event_id] = "error";
    } else {
      calendarSyncStatuses[record.event_id] = "";
    }
  }

  return (
    <main className="space-y-7">
      {/* ヘッダー */}
      <div className="border-b border-line pb-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              イベント管理
            </h1>

            <p className="mt-1 text-sm text-ink-muted">
              イベントの公開状態や申込状況を管理します。
            </p>
          </div>

          <Link
            href="/admin/events/new"
            className="btn btn-primary shrink-0"
          >
            ＋ イベント作成
          </Link>
        </div>

        {/* 回答同期 */}
        <div className="mt-4">
          <SyncEventResponsesButton />
        </div>
      </div>

      {/* 作成済みイベント */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">作成済みイベント</h2>

          <p className="mt-1 text-sm text-ink-muted">
            作成したイベントの内容や申込状況を確認できます。
          </p>
        </div>

        {/* 注意事項 */}
        <div className="card transition hover:shadow-md">
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
              !
            </div>

            <div>
              <p className="font-semibold">公開状態について</p>

              <p className="mt-1 text-sm leading-6">
                公開状態を変更すると、Googleフォームの公開・受付状態にも自動で反映されます。
              </p>

              <p className="mt-1 text-sm font-medium leading-6 text-amber-800">
                Googleフォーム側では公開状態を直接変更せず、必ずこの管理画面から変更してください。
              </p>
            </div>
          </div>
        </div>

        {/* イベントカード一覧 */}
        <EventList events={events} calendarSyncStatuses={calendarSyncStatuses} finishedEventIds={finishedEventIds}/>
      </section>
    </main>
  );
}
