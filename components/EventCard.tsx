"use client";

import { formatEventSchedule } from "@/lib/datetime";
import type { EventWithStatus } from "@/types/event";

interface EventCardProps {
  event: EventWithStatus; // is_answered: true=回答済み / false=未回答 / null=確認できず
}

export default function EventCard({ event }: EventCardProps) {
  const hasLink = event.form_url && event.form_url !== "#";
  const answered = event.is_answered === true;

  return (
    <div className="event-card">
      <div>
        <div className="event-title">{event.title}</div>

        <div className="event-date-box">
          <p className="event-date">📅 {formatEventSchedule(event.event_date, event.event_end_date)}</p>
          {event.location && <p className="event-date">📍 {event.location}</p>}
          {event.is_answered === null && (
            <span style={{ color: "#888" }}>― 回答状況を確認できません</span>
          )}
        </div>
      </div>

      {answered ? (
        <div className="mt-auto text-center">
          <span className="block font-bold text-[15px] py-[10px] text-green-700">✓ 出席登録済み</span>
          {hasLink && (
            <a href={event.form_url} target="_blank" rel="noopener noreferrer"
              className="text-[13px] text-[#4a5568] underline">
              回答を変更する
            </a>
          )}
        </div>
      ) : hasLink ? (
        <a
          href={event.form_url}
          className="block mt-auto text-center font-bold text-[15px] py-[14px] px-4 rounded-[12px] transition-all duration-200 shadow-[0_4px_12px_rgba(27,58,92,0.12)] bg-[#1b3a5c] text-white hover:bg-[#244d7a]"
          target="_blank" rel="noopener noreferrer"
        >
          出席登録フォームへ
        </a>
      ) : (
        <span className="block mt-auto text-center font-bold text-[15px] py-[14px] px-4 rounded-[12px] bg-[#e2e8f0] text-[#8ca3a6] cursor-not-allowed">
          詳細リンクなし
        </span>
      )}
    </div>
  );
}