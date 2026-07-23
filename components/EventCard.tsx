"use client";

import type { EventWithStatus } from "@/types/event";

interface EventCardProps {
  event: EventWithStatus; // true=回答済み / false=未回答 / null=確認できず
}

export default function EventCard({ event }: EventCardProps) {
  const hasLink = event.form_url && event.form_url !== "#";

  return (
    <div className="event-card">
      <div>
        <div className="event-title">{event.title}</div>
        <div className="event-date-box">
          <p className="event-date">{event.event_date}</p>

          {/* サーバーからの正確な情報で判定 */}
          {event.is_answered === true && (
            <span style={{ color: 'green', fontWeight: 'bold' }}>✅ 回答済み</span>
          )}
          {event.is_answered === null && (
            <span style={{ color: '#888' }}>― 回答状況を確認できません</span>
          )}
        </div>
      </div>

      {hasLink ? (
        <a
          href={event.form_url}
          className={`block mt-auto text-center font-bold text-[15px] py-[14px] px-4 rounded-[12px] transition-all duration-200 shadow-[0_4px_12px_rgba(27,58,92,0.12)] ${
            event.is_answered
              ? 'bg-[#e2e8f0] text-[#4a5568] hover:bg-[#cbd5e1]' // 回答済みの場合の色
              : 'bg-[#1b3a5c] text-white hover:bg-[#244d7a]'      // 未回答の場合の色
          }`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {event.is_answered ? '回答を変更する' : '出席登録フォームへ'}
        </a>
      ) : (
        <span className="block mt-auto text-center font-bold text-[15px] py-[14px] px-4 rounded-[12px] bg-[#e2e8f0] text-[#8ca3a6] cursor-not-allowed">
          詳細リンクなし
        </span>
      )}
    </div>
  );
}