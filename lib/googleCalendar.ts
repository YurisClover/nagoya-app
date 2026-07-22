import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";

// 共通の認証インスタンス作成関数
function getAuth() {
  const creds = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!, 'base64').toString());
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar' // カレンダーのスコープを追加
    ],
  });
}

// カレンダーの予定を取得する関数
export async function getCalendarEvents() {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date().toISOString(), // 現在時刻以降の予定を取得
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (error) {
    console.error('カレンダーの取得に失敗しました:', error);
    return [];
  }
}