import {createEventApplyToken,} from "@/lib/event-apply-token";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft,ExternalLink,} from "lucide-react";
import { getEventsData } from "@/lib/events";
import type {EventPosition,} from "@/types/event";

function toEmbedUrl(formUrl: string,): string | null {try {const url = new URL(formUrl);
    const allowed = url.hostname === "docs.google.com" || url.hostname === "forms.gle";
    if (!allowed) {return null;}url.searchParams.set("embedded","true",);
    return url.toString();
  } catch {
    return null;
  }
}
export default async function EventFormPage({ params,}: {
  params: Promise<{eventId: string;}>;}) {
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
  const positions: EventPosition[] = role === "executive" || role === "admin"? ["general", "executive"]: ["general"];
  const viewer = {memberId,role: session.user.role || undefined,};
  const eventLists = await Promise.all(positions.map( (position) => getEventsData( viewer, position,), ),);
  const event = eventLists .flat().find( (item) => item.event_id === eventId,);
   if (!event) {
     notFound();
   }
  const applyToken = createEventApplyToken({eventId: event.event_id, memberId, });
  const prefillTemplate = event.prefill_url_template.trim();
  const prefilledFormUrl = prefillTemplate.includes( "__APPLY_TOKEN__",) ? prefillTemplate.replace( "__APPLY_TOKEN__",
        encodeURIComponent(applyToken, ), ) : null;
  const embedUrl = prefilledFormUrl? toEmbedUrl(prefilledFormUrl,): null;
  return (
      <div className="page-container">
        <div className="mb-3 flex items-center justify-between">
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
            href={prefilledFormUrl}
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
        </div>

        <h1 className="mb-3 truncate text-lg font-bold">
          {event.title}
        </h1>

        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={`${event.title} 出席登録フォーム`}
            className="min-h-[75vh] w-full rounded-card border border-line bg-surface"
          />
        ) : (
          <p className="card p-8 text-center text-sm text-red-600">
            フォームの事前入力URLが正しく設定されていません。管理者にお問い合わせください。
          </p>
        )}
      </div>
  );
}


// import { auth } from "@/auth";
// import { redirect, notFound } from "next/navigation";
// import Link from "next/link";
// import { ChevronLeft, ExternalLink } from "lucide-react";
// import AppShell from "@/components/AppShell";
// import { getEventsData } from "@/lib/events";

// // only Google Forms
// function toEmbedUrl(formUrl: string): string | null {
//   try {
//     const u = new URL(formUrl);
//     const allowed = u.hostname === "docs.google.com" || u.hostname === "forms.gle";
//     if (!allowed) return null;
//     u.searchParams.set("embedded", "true"); // hide google header/footer
//     return u.toString();
//   } catch {
//     return null;
//   }
// }

// export default async function EventFormPage({
//   params,
// }: {
//   params: Promise<{ eventId: string }>; // key must be same name as [eventId] folder
// }) {
//   const session = await auth();
//   if (!session) redirect("/login");
//   const { eventId } = await params;

//   // event that user no permission to see (draft/役員向け) → 404
//   const events = await getEventsData({
//     memberId: session.user?.id || undefined,
//     role: session.user?.role || undefined,
//   });
//   const event = events.find((e) => e.event_id === eventId);
//   if (!event) notFound();

//   const embedUrl = toEmbedUrl(event.form_url);

//   return (
//     <AppShell>
//       <div className="page-container">
//         <div className="mb-3 flex items-center justify-between">
//           <Link
//             href="/events"
//             className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
//           >
//             <ChevronLeft size={16} className="shrink-0" />
//             イベント一覧へ
//           </Link>
//           <a
//             href={event.form_url}
//             target="_blank"
//             rel="noopener noreferrer"
//             className="text-meta inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
//           >
//             <ExternalLink size={14} className="shrink-0" />
//             別タブで開く
//           </a>
//         </div>

//         <h1 className="mb-3 truncate text-lg font-bold">{event.title}</h1>

//         {embedUrl ? (
//           <iframe
//             src={embedUrl}
//             title={`${event.title} 出席登録フォーム`}
//             className="min-h-[75vh] w-full rounded-card border border-line bg-surface"
//           />
//         ) : (
//           <p className="card p-8 text-center text-sm text-red-600">
//             フォームのURLが正しく設定されていません。管理者にお問い合わせください。
//           </p>
//         )}
//       </div>
//     </AppShell>
//   );
// }