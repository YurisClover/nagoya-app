"use client";

import { CalendarDays, MapPin, CheckCircle2 } from "lucide-react";
import { formatEventSchedule } from "@/lib/datetime";
import type { EventWithStatus } from "@/types/event";

export default function EventCard({ event }: { event: EventWithStatus }) {
  const hasLink = event.form_url && event.form_url !== "#";
  const answered = event.is_answered === true;

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <p className="text-base font-bold">{event.title}</p>
        <p className="text-meta mt-2 flex items-center gap-1.5">
          <CalendarDays size={14} className="shrink-0" />
          {formatEventSchedule(event.event_date, event.event_end_date)}
        </p>
        {event.location && (
          <p className="text-meta mt-1 flex items-center gap-1.5">
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
          {hasLink && (
            <a href={event.form_url} target="_blank" rel="noopener noreferrer"
               className="text-meta underline">
              回答を変更する
            </a>
          )}
        </div>
      ) : hasLink ? (
        <a href={event.form_url} target="_blank" rel="noopener noreferrer"
           className="btn btn-primary w-full">
          出席登録フォームへ
        </a>
      ) : (
        <span className="btn btn-secondary w-full cursor-not-allowed opacity-60">
          詳細リンクなし
        </span>
      )}
    </div>
  );
}