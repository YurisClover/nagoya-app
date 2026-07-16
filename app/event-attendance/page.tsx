// 💡 イベントデータの型定義（TypeScript用）
interface EventItem {
  id: number | null;
  title: string;
  event_date: string;
  form_url: string;
}

// 💡 サーバーサイドでデータを取得する関数（HTMLの loadAllEvents に相当）
async function getEvents(): Promise<EventItem[]> {
  try {
    // 常に最新のスプレッドシートデータを取得するためにキャッシュを無効化 (no-store)
    const res = await fetch("http://localhost:5001", { cache: "no-store" });
    if (!res.ok) throw new Error("サーバーエラー");
    return res.json();
  } catch (error) {
    console.error("データ取得失敗:", error);
    throw error;
  }
}

export default async function Home() {
  let events: EventItem[] = [];
  let isError = false;

  try {
    events = await getEvents();
  } catch (e) {
    isError = true;
  }

  return (
    <main className="container">
      <h2>イベント案内一覧</h2>

      <div className="event-grid">
        {isError ? (
          /* 💡 HTMLの catch (error) ブロックに相当するエラー表示 */
          <div className="error-msg">
            <h3>通信エラーが発生しました</h3>
            <p>Node.jsサーバー(ポート5001)が正しく起動しているか確認してください。</p>
          </div>
        ) : events.length === 0 ? (
          /* 💡 HTMLの events.length === 0 のときの表示 */
          <p className="no-events">現在、案内中の一覧はありません。</p>
        ) : (
          /* 💡 HTMLの events.forEach に相当する、Reactのループ処理(map) */
          events.map((event, index) => {
            const hasLink = event.form_url && event.form_url !== "#";

            return (
              <div key={event.id ?? index} className="event-card">
                <div>
                  <div className="event-title">{event.title}</div>
                  <div className="event-date-box">
                    <p className="event-date"> {event.event_date}</p>
                  </div>
                </div>

                {/* 💡 フォームURLがあるかどうかのボタン出し分け（三項演算子） */}
                {hasLink ? (
                  <a
                    href={event.form_url}
                    className="form-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    出席登録フォームへ
                  </a>
                ) : (
                  <span className="form-btn disabled-btn">
                    詳細リンクなし
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}