import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
// 💡 あなたのコードと同じパスから設定ファイルを安全に読み込みます
import CREDIT from './config.json'; 

const SPREADSHEET_KEY = '1zc3Bs31h0uIm7rhiWXtyV2vaor9lIGrO9PtVTXv0ZIs';

// 💡 あなたの認証処理をそのままベースにして、最新行のデータを抜き出す関数へ最適化
async function getLatestEventFromSpreadsheet() {
  try {
    const serviceAccountAuth = new JWT({
      email: CREDIT.client_email,
      key: CREDIT.private_key.replace(/\\n/g, '\n'), 
      scopes: ['https://googleapis.com'], 
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_KEY, serviceAccountAuth);
    await doc.loadInfo(); 
    
    // 接続成功したら、そのまま一番左のシートのデータ行（2行目以降）を全取得
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    if (rows.length === 0) {
      return { title: '案内はありません', event_date: 'データが空です', form_url: '#' };
    }

    // 最下行（最新のイベント）を取得
    const latestRow = rows[rows.length - 1];

    return {
      title: latestRow.get('title') || 'タイトル未設定',
      event_date: latestRow.get('event_date') || '日時未設定',
      form_url: latestRow.get('form_url') || '#'
    };
  } catch (err) {
    console.error("❌ スプレッドシート連動エラー:", err.message);
    return { title: 'エラー', event_date: 'データを取得できませんでした。', form_url: '#' };
  }
}

// 💡 ポート5500番でブラウザに表示されるメインの画面コンポーネント
export default async function EventAttendancePage() {
  // 画面を開く瞬間に、サーバーサイド側でスプレッドシートからデータを取得
  const eventData = await getLatestEventFromSpreadsheet();

  return (
    <div style={styles.body}>
      <div style={styles.card}>
        <h1 style={styles.h1}>{eventData.title}</h1>
        <p style={styles.p}>{eventData.event_date}</p>
        
        {/* フォームURLが正しく設定されている場合のみボタンを表示 */}
        {eventData.form_url !== '#' && (
          <a href={eventData.form_url} target="_blank" rel="noopener noreferrer" style={styles.btn}>
            googleフォーム
          </a>
        )}
      </div>
    </div>
  );
}

// ご指定の「名古屋大花火大会」の夜空スタイル
const styles = {
  body: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    backgroundColor: '#0b132b',
    color: '#ffffff',
    margin: 0,
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    boxSizing: 'border-box'
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    width: '100%',
    maxWidth: '400px',
    borderRadius: '20px',
    boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5)',
    padding: '40px 24px',
    boxSizing: 'border-box',
    textAlign: 'center'
  },
  h1: {
    fontSize: '26px',
    fontWeight: 'bold',
    marginTop: 0,
    marginBottom: '15px',
    color: '#ffdd67',
    textShadow: '0 2px 10px rgba(255, 221, 103, 0.3)',
    letterSpacing: '1px'
  },
  p: {
    fontSize: '18px',
    color: '#e0e6ed',
    marginTop: 0,
    marginBottom: '35px',
    fontWeight: '500'
  },
  btn: {
    display: 'block',
    background: 'linear-gradient(135deg, #ff4757, #ff6b81)',
    color: 'white',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '16px',
    padding: '14px',
    borderRadius: '50px',
    boxShadow: '0 4px 15px rgba(255, 71, 87, 0.4)',
    letterSpacing: '0.5px'
  }
};
