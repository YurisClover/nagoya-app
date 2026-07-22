import "server-only"
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";

function parseEventDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/); // time
    const hour = timeMatch ? parseInt(timeMatch[1], 10) : 0;
    const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;

    const withYear = dateStr.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/); // year
    if (withYear) return new Date(+withYear[1], +withYear[2] - 1, +withYear[3], hour, minute);

    const md = dateStr.match(/(\d{1,2})\/(\d{1,2})/); // 
    if (!md) return null;
    const month = +md[1] - 1, day = +md[2];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let d = new Date(now.getFullYear(), month, day, hour, minute);
    if (d < today) d = new Date(now.getFullYear() + 1, month, day, hour, minute);
    return d;
}

// 2. ユーザーが回答済みかチェックするヘルパー
async function checkParticipation(sheet: GoogleSpreadsheetWorksheet, userName: string): Promise<boolean> {
  try {
    const rows = await sheet.getRows();
    const targetName = userName.trim();
    return rows.some(row => (row.get('参加者の名前をご記入ください。') || '').trim() === targetName);
  } catch (e) {
    return false;
  }
}

export async function getEventsData(userName?: string) {
  const creds = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!, 'base64').toString());
  const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  
  const eventRows = await doc.sheetsByTitle['Events'].getRows();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // イベントごとのデータ処理
  const events = await Promise.all(eventRows.map(async (row, index) => {
    const title = row.get('title') || 'タイトル未設定';
    const dateStr = row.get('event_date') || "";
    
    // 回答状況の判定
    let is_answered = false;
    if (userName) {
      const participantSheet = doc.sheetsByTitle[title];
      if (participantSheet) {
        is_answered = await checkParticipation(participantSheet, userName);
      }
    }

    return {
      id: index,
      title,
      event_date: dateStr,
      form_url: row.get('form_url') || '#',
      _dateObj: parseEventDate(dateStr),
      is_answered,
    };
  }));

  // フィルタリングと並び替え
  return events
    .filter((e): e is (typeof events)[number] & {_dateObj: Date} => e._dateObj !== null && e._dateObj >= today)
    .sort((a, b) => a._dateObj.getTime() - b._dateObj.getTime())
    .map(({ _dateObj, ...rest }) => rest);
}