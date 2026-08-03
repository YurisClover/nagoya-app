import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { getEventsData } from "@/lib/events";

// only Google Forms
function toEmbedUrl(formUrl: string): string | null {
  try {
    const u = new URL(formUrl);
    const allowed = u.hostname === "docs.google.com" || u.hostname === "forms.gle";
    if (!allowed) return null;
    u.searchParams.set("embedded", "true"); // hide google header/footer
    return u.toString();
  } catch {
    return null;
  }
}

export default async function EventFormPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { eventId } = await params;

  const events = await getEventsData(); // use snapshot cache
  const event = events.find((e) => e.event_id === eventId);
  if (!event) notFound();

  const embedUrl = toEmbedUrl(event.form_url);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link href="/events" className="shrink-0 text-sm text-blue-600 hover:underline">
            ← イベント一覧へ
          </Link>
          <p className="truncate text-sm font-bold">{event.title}</p>
        </div>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={`${event.title} 出席登録フォーム`}
            className="min-h-[75vh] w-full rounded-lg border bg-white"
          />
        ) : (
          <p className="p-8 text-center text-sm text-red-600">
            フォームのURLが正しくありません。
          </p>
        )}
      </div>
    </AppShell>
  );
}