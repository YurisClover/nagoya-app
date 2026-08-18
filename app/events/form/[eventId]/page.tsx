import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getEventsData } from "@/lib/events";
import type { EventPosition } from "@/types/event";
import EventFormViewer from "./event-form-viewer";

function toEmbedUrl(formUrl: string): string | null {
  try {
    const url = new URL(formUrl);
    const allowed =
      url.hostname === "docs.google.com" || url.hostname === "forms.gle";
    if (!allowed) {
      return null;
    }
    url.searchParams.set("embedded", "true");
    return url.toString();
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

  if (!session?.user) {
    redirect("/login");
  }

  const { eventId } = await params;
  const memberId = session.user.id?.trim();

  if (!memberId) {
    redirect("/login");
  }

  const role = session.user.role;
  const positions: EventPosition[] =
    role === "executive" || role === "admin"
      ? ["general", "executive"]
      : ["general"];
  const viewer = { memberId, role: session.user.role || undefined };
  const eventLists = await Promise.all(
    positions.map((position) => getEventsData(viewer, position)),
  );
  const event = eventLists.flat().find((item) => item.event_id === eventId);

  if (!event) {
    notFound();
  }

  const prefillTemplate = event.prefill_url_template.trim();

  /*
   * 暗号化は行わず、
   * ログイン中の会員IDを
   * そのまま事前入力する。
   */
  const prefilledFormUrl = prefillTemplate.includes("__MEMBER_ID__")
    ? prefillTemplate.replace("__MEMBER_ID__", encodeURIComponent(memberId))
    : null;
  const embedUrl = prefilledFormUrl ? toEmbedUrl(prefilledFormUrl) : null;

  return (
    <div className="page-container">
      {/* <div className="mb-3 flex items-center justify-between">
        <Link
          href="/events"
          className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
        >
          <ChevronLeft
            size={16}
            className="shrink-0"
          />

          イベント一覧へ
        </Link>

        {prefilledFormUrl && (
          <a
            href={
              prefilledFormUrl
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-meta inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
          >
            <ExternalLink
              size={14}
              className="shrink-0"
            />

            別タブで開く
          </a>
        )}
      </div> */}

      <div className="mb-3 flex items-center">
        <Link
          href="/events"
          className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
        >
          <ChevronLeft size={16} className="shrink-0" />
          イベント一覧へ
        </Link>
      </div>

      <h1 className="mb-3 truncate text-lg font-bold">{event.title}</h1>

      {/* {embedUrl ? (
        <iframe
          src={
            embedUrl
          }
          title={`${event.title} 出席登録フォーム`}
          className="min-h-[75vh] w-full rounded-card border border-line bg-surface"
        />
      ) : (
        <p className="card p-8 text-center text-sm text-red-600">
          フォームの事前入力URLが正しく設定されていません。管理者にお問い合わせください。
        </p>
      )} */}

      {embedUrl && prefilledFormUrl ? (
        <EventFormViewer
          // eventId={
          //   event.event_id
          // }
          eventTitle={event.title}
          prefilledFormUrl={prefilledFormUrl}
          embedUrl={embedUrl}
          // initiallyAnswered={
          //   event.is_answered ===
          //   true
          // }
        />
      ) : (
        <p className="card p-8 text-center text-sm text-red-600">
          フォームの事前入力URLが正しく設定されていません。管理者にお問い合わせください。
        </p>
      )}
    </div>
  );
}
