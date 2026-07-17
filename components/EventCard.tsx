"use client"; // まだ使いますが、中身はシンプルになります

interface EventCardProps {
  event: {
    id: number | null;
    title: string;
    event_date: string;
    form_url: string;
    is_answered: boolean; // サーバーからの値を確実に受け取る
  };
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
          {event.is_answered && (
            <span style={{ color: 'green', fontWeight: 'bold' }}>✅ 回答済み</span>
          )}
        </div>
      </div>

      {hasLink ? (
        <a
          href={event.form_url}
          className={`form-btn ${event.is_answered ? 'already-answered' : ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {event.is_answered ? '回答を変更する' : '出席登録フォームへ'}
        </a>
      ) : (
        <span className="form-btn disabled-btn">詳細リンクなし</span>
      )}
    </div>
  );
}