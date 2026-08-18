import "server-only";
import { google,} from "googleapis";
import { getServiceAccountCredentials,} from "@/lib/google-auth";
import type { EventPosition,} from "@/types/event";

const CALENDAR_SCOPE = [ "https://www.googleapis.com/auth/calendar",];
const TIME_ZONE = "Asia/Tokyo";

export type GoogleCalendarEventInput = {
  eventId: string;
  title: string;
  eventDate: string;
  eventEndDate: string;
  location: string;
  position: EventPosition;
};
export type CreatedGoogleCalendarEvent = {
  calendarId: string;
  calendarEventId: string;
};

/**
 * positionに対応するGoogleカレンダーIDを取得する。
 */
export function getGoogleCalendarId(position: EventPosition,): string {
  const calendarId = position === "executive" ? process.env.GOOGLE_CALENDAR_EXECUTIVE_ID ?.trim()
   : process.env .GOOGLE_CALENDAR_GENERAL_ID ?.trim();

  if (!calendarId) {
    throw new Error(
      position === "executive" ? "GOOGLE_CALENDAR_EXECUTIVE_IDが設定されていません。" : "GOOGLE_CALENDAR_GENERAL_IDが設定されていません。",
    );
  } return calendarId;
}

/**
 * Google Calendar APIクライアントを作成する。
 *
 * googleapisと同じパッケージからGoogleAuthを生成し、
 * google-auth-libraryの型重複を避ける。
 */
function createCalendarClient() {
  const { client_email, private_key, } = getServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({ credentials: { client_email, private_key, }, scopes: CALENDAR_SCOPE, });
  return google.calendar({
    version: "v3", auth,
  });
}

/**
 * datetime-local形式をCalendar APIへ渡せる形に整える。
 * 例:
 * 2026-08-18T18:00
 * ↓
 * 2026-08-18T18:00:00
 */
function normalizeDateTime( value: string,): string {
  const normalized = value.trim().replace( " ", "T", );
  if ( /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test( normalized,) ) {
    return `${normalized}:00`;
  }

  if ( /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test( normalized, )) {
    return normalized;
  }
  throw new Error( `カレンダーへ登録する日時の形式が正しくありません: ${value}`,);
}

/**
 * Googleカレンダーへ予定を新規登録する。
 */
export async function createGoogleCalendarEvent( input: GoogleCalendarEventInput,): Promise<CreatedGoogleCalendarEvent> {
  const calendarId = getGoogleCalendarId( input.position, );
  const calendar = createCalendarClient();
  const response = await calendar.events.insert({ calendarId, requestBody: {
        summary: input.title,
        location: input.location || undefined,
        start: { dateTime: normalizeDateTime( input.eventDate, ), timeZone: TIME_ZONE, },
        end: { dateTime:normalizeDateTime( input.eventEndDate, ), timeZone: TIME_ZONE, },
         // Googleカレンダーの予定とEventsシートのイベントを結び付ける。
        extendedProperties: { private: { app_event_id: input.eventId,app_position: input.position, }, },
      },
    });
  const calendarEventId = response.data.id?.trim();
  if (!calendarEventId) {
    throw new Error( "Googleカレンダーの予定IDを取得できませんでした。", );
  }
  return { calendarId,calendarEventId, };
}

/**
 * Googleカレンダーから予定を削除する。
 */
export async function deleteGoogleCalendarEvent({ calendarId, calendarEventId,}: {calendarId: string; calendarEventId: string;
}): Promise<void> {
  const calendar = createCalendarClient();
  await calendar.events.delete({ calendarId, eventId: calendarEventId, });
}

/**
 * 指定期間のGoogleカレンダー予定を取得する。
 * timeMin・timeMaxには、タイムゾーン付きの
 * RFC3339文字列を渡す。
 */
export async function listGoogleCalendarEvents({
  position,
  timeMin,
  timeMax,
}: {
  position: EventPosition;
  timeMin: string;
  timeMax: string;
}) {
  const calendarId = getGoogleCalendarId( position, );
  const calendar = createCalendarClient();
  const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      timeZone: TIME_ZONE,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
      maxResults: 2500,
    });
  return response.data.items ?? [];
}