// 💡 まず、受け取るデータの形を定義します
interface EventCardProps {
  event: {
    id: number | null;
    title: string;
    event_date: string;
    form_url: string;
    is_answered: boolean;
  };
}

// 💡 定義した型をコンポーネントの引数に適用します
export default function EventCard({ event }: EventCardProps) {
  const hasLink = event.form_url && event.form_url !== "#";
  
  return (
    <div className="event-card">
      {/* 中身はそのまま */}
      <div>
        <div className="event-title">{event.title}</div>
        <div className="event-date-box">
          <p className="event-date">{event.event_date}</p>
          {event.is_answered && (
            <span style={{ color: 'green', fontWeight: 'bold' }}>✅ 回答済み</span>
          )}
        </div>
      </div>

      {hasLink ? (
        <a href={event.form_url} className={`form-btn ${event.is_answered ? 'already-answered' : ''}`} target="_blank" rel="noopener noreferrer">
          {event.is_answered ? '回答を変更する' : '出席登録フォームへ'}
        </a>
      ) : (
        <span className="form-btn disabled-btn">詳細リンクなし</span>
      )}
    </div>
  );
}