import "server-only";
import type { SheetEvent,} from "@/lib/sheets/events";
import {clearCalendarRecord, getCalendarRecord, saveCalendarSyncError, saveCalendarSyncSuccess, type CalendarRecord,
} from "@/lib/sheets/calendar";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent, getGoogleCalendarId, moveGoogleCalendarEvent,
} from "@/lib/google-calendar";

export type EventCalendarSyncResult =  | {
      success: true;
      record: CalendarRecord | null;
      error: null;
    } | {
      success: false;
      record: CalendarRecord | null;
      error: string;
    };

function getErrorMessage( error: unknown,): string { return error instanceof Error ? error.message 
    : "不明なカレンダー同期エラー";}

/**
 * カレンダー同期エラーをCalendarシートへ記録する。
 *
 * Calendarシート自体への書き込みにも失敗した場合は、
 * 元のエラーを失わないようconsoleにも記録する。
 */
async function recordSyncError( eventId: string, error: unknown,): Promise<CalendarRecord | null> {
  const errorMessage = getErrorMessage( error,);
  console.error( "Google Calendar sync error:", { eventId, error: errorMessage,},);

  try {
    return await saveCalendarSyncError( eventId, );
  } catch (
    recordError
  ) {
    console.error("Calendarシートへの同期エラー記録に失敗しました。", {eventId, error: getErrorMessage( recordError, ),}, );
    return null;
  }
}

/**
 * カレンダー処理を実行する。
 *
 * 失敗してもイベント管理処理は取り消さず、
 * 結果をsuccess=falseとして返す。
 */
async function runCalendarSync(
  eventId: string,
  action: () => Promise< CalendarRecord | null >,): Promise<EventCalendarSyncResult> {
  try {
    const record = await action();
    return {
      success: true,
      record,
      error: null,
    };
  } catch (error) {
    const record = await recordSyncError( eventId, error, );
    return {
      success: false,
      record,
      error: getErrorMessage( error,),
    };
  }
}

/**
 * publishedイベントをGoogleカレンダーへ登録する。
 *
 * 既に登録済みの場合は重複登録しない。
 * 登録先がpositionと異なる場合は予定を移動する。
 */
export async function syncPublishedEventCalendar( event: SheetEvent,): Promise<EventCalendarSyncResult> {
  return runCalendarSync( 
    event.event_id,
    async () => {
      const existingRecord = await getCalendarRecord( event.event_id, );
      const destinationCalendarId = getGoogleCalendarId( event.position, );
      const existingCalendarEventId = existingRecord ?.google_calendar_event_id .trim() ?? "";
      const existingCalendarId = existingRecord ?.google_calendar_id .trim() ?? "";

      /*
       * 既に同じカレンダーへ登録済みなら、
       * 重複登録せず同期成功として記録する。
       */
      if ( existingCalendarEventId && existingCalendarId === destinationCalendarId) {
        return saveCalendarSyncSuccess({
          eventId: event.event_id,
          googleCalendarEventId: existingCalendarEventId,
          googleCalendarId: existingCalendarId,
        });
      }

      /*
       * 登録済みだがpositionが変わっている場合は、
       * 予定を別カレンダーへ移動する。
       */
      if (existingCalendarEventId && existingCalendarId && existingCalendarId !== destinationCalendarId ) {
        const movedEvent = await moveGoogleCalendarEvent({
             sourceCalendarId: existingCalendarId,
             calendarEventId: existingCalendarEventId,
             destinationCalendarId,
             });
        return saveCalendarSyncSuccess({
          eventId: event.event_id,
          googleCalendarEventId: movedEvent .calendarEventId,
          googleCalendarId: movedEvent .calendarId,
        });
      }

      /*
       * IDの片方だけが存在する状態では、
       * 正しい予定を特定できないためエラーにする。
       */
      if ( existingCalendarEventId || existingCalendarId ) {
        throw new Error( "Calendarシートの予定IDまたはカレンダーIDが不足しています。", );
      }
      const createdEvent = await createGoogleCalendarEvent({
          eventId: event.event_id,
          title: event.title,
          eventDate: event.event_date,
          eventEndDate: event.event_end_date,
          location: event.location,
          position: event.position,
        });
      return saveCalendarSyncSuccess({
        eventId: event.event_id,
        googleCalendarEventId: createdEvent .calendarEventId,
        googleCalendarId: createdEvent .calendarId,
      });
    },
  );
}

/**
 * position変更後に登録先を同期する。
 *
 * published・closedだけを対象とし、
 * draftはGoogleカレンダーへ登録しない。
 */
export async function syncEventPositionCalendar( event: SheetEvent,): Promise<EventCalendarSyncResult> {
  if ( event.status !== "published" && event.status !== "closed") {
    return {
      success: true,
      record: await getCalendarRecord( event.event_id,),
      error: null,
    };
  }
  return syncPublishedEventCalendar( event, );
}

/**
 * Googleカレンダーから予定を削除する。
 *
 * Calendarシートに予定IDがない場合は、
 * 削除済みとして正常終了する。
 */
export async function removeEventCalendar( eventId: string,): Promise<EventCalendarSyncResult> {
  return runCalendarSync( eventId, async () => {
      const existingRecord = await getCalendarRecord( eventId, );
      if (!existingRecord) {
        return null;
      }
      const calendarEventId = existingRecord .google_calendar_event_id .trim();
      const calendarId = existingRecord .google_calendar_id .trim();

      /*
       * 初回公開失敗などで両方空欄の場合は、
       * 連携情報だけ空欄へ戻す。
       */
      if ( !calendarEventId && !calendarId ) {
        return clearCalendarRecord( eventId, );
      }
      if (!calendarEventId || !calendarId ) {
        throw new Error( "Calendarシートの予定IDまたはカレンダーIDが不足しています。", );
      }
      await deleteGoogleCalendarEvent({ calendarId, calendarEventId, });
      return clearCalendarRecord( eventId, );
    },
  );
}