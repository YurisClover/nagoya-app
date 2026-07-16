import express from 'express';
import cors from 'cors';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());

// ==========================================
// 1. JSONファイルを安全に自動読み込み
// ==========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const credentialsPath = path.join(__dirname, 'credentials.json');

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  console.log("🔑 credentials.json の読み込みに成功しました。");
} catch (err) {
  console.error("❌ credentials.json が見つからないか、中身が壊れています。");
  process.exit(1);
}

const serviceAccountAuth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = '1zc3Bs31h0uIm7rhiWXtyV2vaor9lIGrO9PtVTXv0ZIs'; 
const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

// ==========================================
// 2. 日付パース用の関数
// ==========================================
const parseEventDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '' || dateStr === '日時未設定') return 0;
  const dateMatch = dateStr.match(/(\d+)\/(\d+)/);
  if (!dateMatch) return 0;
  const month = parseInt(dateMatch[1], 10);
  const day = parseInt(dateMatch[2], 10);
  const timeMatch = dateStr.match(/(\d+):(\d+)/);
  const hour = timeMatch ? parseInt(timeMatch[1], 10) : 0;
  const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;
  const currentYear = new Date().getFullYear();
  return new Date(currentYear, month - 1, day, hour, minute, 0, 0).getTime();
};

const getEventDateOnly = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '' || dateStr === '日時未設定') return 0;
  const dateMatch = dateStr.match(/(\d+)\/(\d+)/);
  if (!dateMatch) return 0;
  const month = parseInt(dateMatch[1], 10);
  const day = parseInt(dateMatch[2], 10);
  const currentYear = new Date().getFullYear();
  return new Date(currentYear, month - 1, day, 0, 0, 0, 0).getTime();
};

// ==========================================
// 3. メイン API ルート (GET /)
// ==========================================
app.get('/', async (req, res) => {
  const user_name = req.query.user_name;
  
  // 💡 ここにログを追加！
  console.log("DEBUG: APIが受け取ったユーザー名:", user_name);

  // ...以降の処理...
  console.log(`\n=== 🔍 APIリクエストを受信しました ===`);

  try {
    await doc.loadInfo();
   // doc.sheetsByIndex[0] は「左から4番目のタブ」を読み込みます
    const mainSheet = doc.sheetsByIndex[3];
    if (!mainSheet) throw new Error("「EVENTS」シートが見つかりません。");

    const rows = await mainSheet.getRows();
    const rawEvents = rows.map(row => ({
      event_id: row.get('event_id'),
      title: row.get('title'),
      event_date: row.get('event_date'),
      location: row.get('location'),
      form_url: row.get('form_url')
    }));

    const updatedEvents = [];

    for (const event of rawEvents) {
      if (!event.title || !event.event_date) continue;

      let is_answered = false;

      if (user_name && user_name !== 'undefined') {
        try {
          const responseSheet = doc.sheetsByTitle[event.title] || doc.sheetsByTitle[`${event.title}`];
          if (responseSheet) {
            await responseSheet.loadHeaderRow();
            const responseRows = await responseSheet.getRows();
            const targetColumn = "参加者の名前をご記入ください。";
            
            is_answered = responseRows.some(r => {
              const nameInSheet = r.get(targetColumn); 
              return nameInSheet && String(nameInSheet).trim() === user_name.trim();
            });
          }
        } catch (sheetError) {
          console.error(`❌ イベント [${event.title}] の回答確認エラー:`, sheetError.message);
        }
      }
      updatedEvents.push({ ...event, is_answered });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const filteredEvents = updatedEvents.filter(event => {
      const eventTime = getEventDateOnly(event.event_date);
      return eventTime === 0 || eventTime >= todayTime;
    });

    const sortedEvents = filteredEvents.sort((a, b) => {
      const timeA = parseEventDate(a.event_date);
      const timeB = parseEventDate(b.event_date);
      if (timeA === 0) return 1;
      if (timeB === 0) return -1;
      return timeA - timeB;
    });

    res.json(sortedEvents);

  } catch (err) {
    console.error("❌ システム致命的エラー:", err);
    res.status(500).json({ error: `データ取得に失敗しました: ${err.message}` });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});