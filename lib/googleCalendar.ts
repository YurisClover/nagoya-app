import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '';

// 1. 認証インスタンスを作成する関数
function getAuth() {
  const creds = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!, 'base64').toString()
  );
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
    ],
  });
}

// 2. カレンダーの予定一覧を取得する関数
export async function getCalendarEvents() {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (error) {
    console.error('カレンダーの取得に失敗しました:', error);
    return [];
  }
}

// 3. 日付文字列を解析して Date オブジェクトに変換する関数
function parseEventDateTime(dateStr: string): { start: Date; end: Date } | null {
  const parts = dateStr.split(/[~～]/);
  if (parts.length < 2) return null;

  const startPart = parts[0].trim();
  const endPart = parts[1].trim();

  // 開始日時の解析
  const startMatch = startPart.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2}).*?(\d{1,2}):(\d{2})/);
  if (!startMatch) return null;

  const startYear = parseInt(startMatch[1]);
  const startMonth = parseInt(startMatch[2]) - 1; // JavaScriptの仕様で月は0始まりなので-1
  const startDay = parseInt(startMatch[3]);
  const startHour = parseInt(startMatch[4]);
  const startMinute = parseInt(startMatch[5]);
  const startDate = new Date(startYear, startMonth, startDay, startHour, startMinute);

  // 終了部分が時間のみ（例: "20:00"）の場合
  const timeOnlyMatch = endPart.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnlyMatch) {
    const endHour = parseInt(timeOnlyMatch[1]);
    const endMinute = parseInt(timeOnlyMatch[2]);
    const endDate = new Date(startYear, startMonth, startDay, endHour, endMinute);
    return { start: startDate, end: endDate };
  }

  // 終了部分も日付が含まれる場合（例: "2026/8/11(火)20:00"）
  const endMatch = endPart.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2}).*?(\d{1,2}):(\d{2})/);
  if (!endMatch) return null;

  const endYear = parseInt(endMatch[1]);
  const endMonth = parseInt(endMatch[2]) - 1;
  const endDay = parseInt(endMatch[3]);
  const endHour = parseInt(endMatch[4]);
  const endMinute = parseInt(endMatch[5]);
  const endDate = new Date(endYear, endMonth, endDay, endHour, endMinute);

  return { start: startDate, end: endDate };
}

// 4. カレンダーに予定を追加する関数
export async function addEventToCalendar(title: string, dateStr: string, formUrl: string) {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const dates = parseEventDateTime(dateStr);
  if (!dates) {
    console.error('日付が解析できなかったため、スキップしました:', dateStr);
    return;
  }

  try {
    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: title,
        description: `詳細・申込: ${formUrl}`,
        start: {
          dateTime: dates.start.toISOString(),
          timeZone: 'Asia/Tokyo',
        },
        end: {
          dateTime: dates.end.toISOString(),
          timeZone: 'Asia/Tokyo',
        },
      },
    });

    console.log(`カレンダーに登録しました: ${title}`);
    return response.data;
  } catch (error) {
    console.error('カレンダーへの追加に失敗しました:', error);
  }
}

// 5. 表示用の日付文字列を整形する関数
export function formatEventDate(dateStr: string): string {
  if (!dateStr) return '';

  const parts = dateStr.split(/[~～]/);
  if (parts.length < 2) return dateStr;

  const startPart = parts[0].trim();
  const endPart = parts[1].trim();

  // すでに後半が時間だけの場合はそのまま返す
  if (/^\d{1,2}:\d{2}$/.test(endPart)) {
    return `${startPart}~${endPart}`;
  }

  const startMatch = startPart.match(/^(\d{4}[/-]\d{1,2}[/-]\d{1,2})/);
  const endMatch = endPart.match(/^(\d{4}[/-]\d{1,2}[/-]\d{1,2}).*?(\d{1,2}):(\d{2})$/);

  if (startMatch && endMatch) {
    const startDate = startMatch[1];
    const endDate = endMatch[1];
    const endTime = endMatch[2];

    // 日をまたがない場合は時間を短縮して結合する
    if (startDate === endDate) {
      return `${startPart}~${endTime}`;
    }
  }

  // 日をまたぐ場合はそのまま返す
  return dateStr;
}