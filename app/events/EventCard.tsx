// "use client";

// import Link from "next/link";
// import { CalendarDays, MapPin, CheckCircle2, Lock } from "lucide-react";
// import { formatEventSchedule } from "@/lib/datetime";
// import type { EventWithStatus } from "@/types/event";

// export default function EventCard({ event }: { event: EventWithStatus }) {
//   const hasLink = event.form_url && event.form_url !== "#";
//   const answered = event.is_answered === true;
//   const closed = event.status.trim().toLowerCase() === "closed";
//   const inAppHref = event.event_id ? `/events/form/${event.event_id}` : null;

// return (
//     <div className="card flex flex-col gap-4">
//       <div>
//         <p className="flex items-center gap-2 text-base font-bold">
//           <span className="truncate">{event.title}</span>
//           {event.status.trim().toLowerCase() === "draft" && (
//             <span className="badge badge-muted shrink-0">下書き</span>
//           )}
//           {closed && <span className="badge badge-muted shrink-0">受付終了</span>}
//           {event.position.trim().toLowerCase() === "executive" && (
//             <span className="badge shrink-0">役員向け</span>
//           )}
//         </p>
//         <p className="text-meta mt-2 flex items-center gap-1.5">
//           <CalendarDays size={14} className="shrink-0" />
//           {formatEventSchedule(event.event_date, event.event_end_date)}
//         </p>
//         {event.location && (
//           <p className="text-meta mt-1 flex items-center gap-1.5">
//             <MapPin size={14} className="shrink-0" />
//             {event.location}
//           </p>
//         )}
//         {event.is_answered === null && (
//           <p className="text-meta mt-2">回答状況を確認できません</p>
//         )}
//       </div>

//       {answered ? (
//         <div className="text-center">
//           <p className="flex items-center justify-center gap-1.5 py-1 text-sm font-bold text-green-700">
//             <CheckCircle2 size={16} className="shrink-0" />
//             出席登録済み
//           </p>
//           {/* ปิดรับแล้ว → ซ่อนลิงก์แก้คำตอบ (ฟอร์มปิดแล้ว) */}
//           {hasLink && !closed &&
//             (inAppHref ? (
//               <Link href={inAppHref} className="text-meta underline">
//                 回答を変更する
//               </Link>
//             ) : (
//               <a href={event.form_url} target="_blank" rel="noopener noreferrer" className="text-meta underline">
//                 回答を変更する
//               </a>
//             ))}
//         </div>
//       ) : closed ? (
//         <span className="btn btn-secondary w-full cursor-not-allowed opacity-60 inline-flex items-center justify-center gap-1.5">
//           <Lock size={14} className="shrink-0" />
//           受付終了
//         </span>
//       ) : hasLink ? (
//         inAppHref ? (
//           <Link href={inAppHref} className="btn btn-primary w-full">
//             出席登録フォームへ
//           </Link>
//         ) : (
//           <a href={event.form_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
//             出席登録フォームへ
//           </a>
//         )
//       ) : (
//         <span className="btn btn-secondary w-full cursor-not-allowed opacity-60">
//           詳細リンクなし
//         </span>
//       )}
//     </div>
//   );
// }

"use client";

import Link from "next/link";

import {
  CalendarDays,
  CheckCircle2,
  Lock,
  MapPin,
} from "lucide-react";

import {
  formatEventSchedule,
} from "@/lib/datetime";

import type {
  EventWithStatus,
} from "@/types/event";


interface EventCardProps {
  event: EventWithStatus;
}


export default function EventCard({
  event,
}: EventCardProps) {
  /*
   * /api/events側で
   * 回答タブを一括確認済みなので、
   * カード自身では通信しない。
   */
  const answered =
    event.is_answered === true;


  const hasLink =
    Boolean(
      event.form_url &&
        event.form_url !== "#",
    );


  const isClosed =
    event.status === "closed";


  const inAppHref =
    event.event_id
      ? `/events/form/${event.event_id}`
      : null;


  return (
    <div className="card flex flex-col gap-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-base font-bold">
            <span className="block truncate">
              {event.title}
            </span>
          </p>

          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <span
              className={
                isClosed
                  ? "badge badge-muted"
                  : "badge"
              }
            >
              {isClosed
                ? "受付終了"
                : "公開中"}
            </span>

            {event.position ===
              "executive" && (
              <span className="badge">
                執行部向け
              </span>
            )}
          </div>
        </div>


        <p className="text-meta mt-2 flex items-center gap-1.5">
          <CalendarDays
            size={14}
            className="shrink-0"
          />

          {formatEventSchedule(
            event.event_date,
            event.event_end_date,
          )}
        </p>


        {event.location && (
          <p className="text-meta mt-1 flex items-center gap-1.5">
            <MapPin
              size={14}
              className="shrink-0"
            />

            {event.location}
          </p>
        )}


        {event.is_answered ===
          null && (
          <p className="text-meta mt-2">
            回答状況を確認できません
          </p>
        )}
      </div>


      {answered ? (
        <div className="mt-auto text-center">
          <p className="flex items-center justify-center gap-1.5 py-1 text-sm font-bold text-green-700">
            <CheckCircle2
              size={16}
              className="shrink-0"
            />

            出席登録済み
          </p>


          {!isClosed &&
            hasLink &&
            (inAppHref ? (
              <Link
                href={
                  inAppHref
                }
                className="text-meta underline"
              >
                回答を変更する
              </Link>
            ) : (
              <a
                href={
                  event.form_url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-meta underline"
              >
                回答を変更する
              </a>
            ))}
        </div>
      ) : isClosed ? (
        <span className="btn btn-secondary mt-auto inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 opacity-60">
          <Lock
            size={14}
            className="shrink-0"
          />

          受付終了
        </span>
      ) : hasLink ? (
        inAppHref ? (
          <Link
            href={
              inAppHref
            }
            className="btn btn-primary mt-auto w-full"
          >
            出席登録フォームへ
          </Link>
        ) : (
          <a
            href={
              event.form_url
            }
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mt-auto w-full"
          >
            出席登録フォームへ
          </a>
        )
      ) : (
        <span className="btn btn-secondary mt-auto w-full cursor-not-allowed opacity-60">
          詳細リンクなし
        </span>
      )}
    </div>
  );
}