"use client";

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
  const hasLink =
    Boolean(
      event.form_url &&
        event.form_url !== "#",
    );

  const answered =
    event.is_answered === true;

  const isClosed =
    event.status === "closed";

  return (
    <div className="event-card">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="event-title">
            {event.title}
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              isClosed
                ? "bg-[#E2E8F0] text-[#4A5568]"
                : "bg-[#DCFCE7] text-[#166534]"
            }`}
          >
            {isClosed
              ? "受付終了"
              : "公開中"}
          </span>
        </div>

        <div className="event-date-box">
          <p className="event-date">
            日付：
            {formatEventSchedule(
              event.event_date,
              event.event_end_date,
            )}
          </p>

          {event.location && (
            <p className="event-date">
              場所：{event.location}
            </p>
          )}

          {event.is_answered ===
            null && (
            <span
              style={{
                color: "#888",
              }}
            >
              ― 回答状況を確認できません
            </span>
          )}
        </div>
      </div>

      {isClosed ? (
        <div className="mt-auto text-center">
          {answered && (
            <span className="mb-2 block py-2 text-[15px] font-bold text-green-700">
              ✓ 出席登録済み
            </span>
          )}

          <span className="block cursor-not-allowed rounded-[12px] bg-[#E2E8F0] px-4 py-[14px] text-center text-[15px] font-bold text-[#8CA3A6]">
            受付終了
          </span>
        </div>
      ) : answered ? (
        <div className="mt-auto text-center">
          <span className="block py-[10px] text-[15px] font-bold text-green-700">
            ✓ 出席登録済み
          </span>

          {hasLink && (
            <a
              href={event.form_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#4A5568] underline"
            >
              回答を変更する
            </a>
          )}
        </div>
      ) : hasLink ? (
        <a
          href={event.form_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto block rounded-[12px] bg-[#1B3A5C] px-4 py-[14px] text-center text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(27,58,92,0.12)] transition-all duration-200 hover:bg-[#244D7A]"
        >
          出席登録フォームへ
        </a>
      ) : (
        <span className="mt-auto block cursor-not-allowed rounded-[12px] bg-[#E2E8F0] px-4 py-[14px] text-center text-[15px] font-bold text-[#8CA3A6]">
          詳細リンクなし
        </span>
      )}
    </div>
  );
}