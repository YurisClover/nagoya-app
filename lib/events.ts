import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";

// 1. 日付文字列からDate オブジェクトに変換するヘルパー
const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);

  // 先頭の "YYYY/MM/DD" (または "YYYY-MM-DD") 部分を抽出する
  const match = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return new Date(0);

  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const day = parseInt(match[3]);

  return new Date(year, month, day);
};

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
      _dateObj: parseDate(dateStr),
      is_answered,
    };
  }));

  // フィルタリングと並び替え
  return events
    .filter(event => event._dateObj >= today)
    .sort((a, b) => a._dateObj.getTime() - b._dateObj.getTime())
    .map(({ _dateObj, ...rest }) => rest);
}