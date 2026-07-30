"use client";

<<<<<<< HEAD
=======
import { formatEventSchedule } from "@/lib/datetime";
>>>>>>> develop
import type { EventWithStatus } from "@/types/event";

interface EventCardProps {
  event: EventWithStatus; // is_answered: true=回答済み / false=未回答 / null=確認できず
}

export default function EventCard({ event }: EventCardProps) {
  const hasLink = event.form_url && event.form_url !== "#";
  const answered = event.is_answered === true;

  return (
    // カード自体の上の内側余白(paddingTop)を少し狭く(16pxなど)上書きします
    <div className="event-card" style={{ paddingTop: '16px' }}>
      <div>
<<<<<<< HEAD
        {/* タイトルの上の余白(marginTop)を 0 にして上に詰めます */}
        <div className="event-title" style={{ marginTop: 0, marginBottom: '4px' }}>
          {event.title}
        </div>
        
        {/* 日付の下の余白(marginBottom)も 0 にして下に詰めます */}
        <div className="event-date-box" style={{ marginBottom: 0 }}>
          <p className="event-date" style={{ marginTop: 0, marginBottom: 0 }}>
            {event.event_date}
          </p>
        </div>

        {/* ついていた「mt-1(上の余白)」を削除して、さらに上に近づけます */}
        <div className="text-center mb-2">
          {event.is_answered === true && (
            <span style={{ color: 'green', fontWeight: 'bold', fontSize: '14px' }}>✅ 回答済み</span>
          )}
          {event.is_answered === null && (
            <span style={{ color: '#888', fontSize: '14px' }}>― 回答状況を確認できません</span>
=======
        <div className="event-title">{event.title}</div>

        <div className="event-date-box">
          <p className="event-date">📅 {formatEventSchedule(event.event_date, event.event_end_date)}</p>
          {event.location && <p className="event-date">📍 {event.location}</p>}
          {event.is_answered === null && (
            <span style={{ color: "#888" }}>― 回答状況を確認できません</span>
>>>>>>> develop
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
<<<<<<< HEAD
          className={`block mt-auto text-center font-bold text-[15px] py-[14px] px-4 rounded-[12px] transition-all duration-200 shadow-[0_4px_12px_rgba(27,58,92,0.12)] ${
            event.is_answered
              ? 'bg-[#e2e8f0] text-[#4a5568] hover:bg-[#cbd5e1]'
              : 'bg-[#1b3a5c] text-white hover:bg-[#244d7a]'
          }`}
          target="_blank"
          rel="noopener noreferrer"
=======
          className="block mt-auto text-center font-bold text-[15px] py-[14px] px-4 rounded-[12px] transition-all duration-200 shadow-[0_4px_12px_rgba(27,58,92,0.12)] bg-[#1b3a5c] text-white hover:bg-[#244d7a]"
          target="_blank" rel="noopener noreferrer"
>>>>>>> develop
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