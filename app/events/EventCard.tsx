"use client";

import Link from "next/link";
import { CalendarDays, MapPin, CheckCircle2, Lock } from "lucide-react";
import { formatEventSchedule } from "@/lib/datetime";
import type { EventWithStatus } from "@/types/event";

export default function EventCard({ event }: { event: EventWithStatus }) {
  const hasLink = event.form_url && event.form_url !== "#";
  const answered = event.is_answered === true;
  const closed = event.status.trim().toLowerCase() === "closed";
  const inAppHref = event.event_id ? `/events/form/${event.event_id}` : null;

  return (
    <div className="card flex flex-col gap-4">flex items-start justify-between gap-4
      <div>
        <p className="flex items-center gap-2 text-base font-bold">
          <span className="truncate justify-between gap-4">{event.title}</span>
          {event.status.trim().toLowerCase() === "draft" && (
            <span className="badge badge-muted shrink-0">下書き</span>
          )}
          {closed && (
            <span className="badge badge-muted shrink-0">受付終了</span>
          )}
          {event.position.trim().toLowerCase() === "executive" && (
            <span className="badge shrink-0">役員向け</span>
          )}
        </p>
        <p className="text-meta mt-2 flex items-center gap-1.5 truncate">
          <CalendarDays size={14} className="shrink-0" />
          {formatEventSchedule(event.event_date, event.event_end_date)}
        </p>
        {event.location && (
          <p className="text-meta mt-1 flex items-center gap-1.5 truncate">
            <MapPin size={14} className="shrink-0" />
            {event.location}
          </p>
        )}
        {event.is_answered === null && (
          <p className="text-meta mt-2">回答状況を確認できません</p>
        )}
      </div>

      {answered ? (
        <div className="text-center">
          <p className="flex items-center justify-center gap-1.5 py-1 text-sm font-bold text-green-700">
            <CheckCircle2 size={16} className="shrink-0" />
            出席登録済み
          </p>
          {hasLink &&
            !closed &&
            (inAppHref ? (
              <Link href={inAppHref} className="text-meta underline">
                回答を変更する
              </Link>
            ) : (
              <a
                href={event.form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-meta underline"
              >
                回答を変更する
              </a>
            ))}
        </div>
      ) : closed ? (
        <span className="btn btn-secondary w-full cursor-not-allowed opacity-60 inline-flex items-center justify-center gap-1.5">
          <Lock size={14} className="shrink-0" />
          受付終了
        </span>
      ) : hasLink ? (
        inAppHref ? (
          <Link href={inAppHref} className="btn btn-primary w-full">
            出席登録フォームへ
          </Link>
        ) : (
          <a
            href={event.form_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full"
          >
            出席登録フォームへ
          </a>
        )
      ) : (
        <span className="btn btn-secondary w-full cursor-not-allowed opacity-60">
          詳細リンクなし
        </span>
      )}
    </div>
  );
}
