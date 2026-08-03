import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
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
      <div className="mx-auto max-w-3xl p-4">
        {/* header — โครงเดียวกับ /site/view: [← back] ... [別タブで開く] */}
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/events"
            className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <ChevronLeft size={16} className="shrink-0" />
            イベント一覧へ
          </Link>
          <a
            href={event.form_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-meta inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
          >
            <ExternalLink size={14} className="shrink-0" />
            別タブで開く
          </a>
        </div>

        <h1 className="mb-3 truncate text-lg font-bold">{event.title}</h1>

        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={`${event.title} 出席登録フォーム`}
            className="min-h-[75vh] w-full rounded-card border border-line bg-surface"
          />
        ) : (
          <p className="card p-8 text-center text-sm text-red-600">
            フォームのURLが正しく設定されていません。管理者にお問い合わせください。
          </p>
        )}
      </div>
    </AppShell>
  );
}