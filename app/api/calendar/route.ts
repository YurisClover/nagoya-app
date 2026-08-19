import { auth,} from "@/auth";
import { listGoogleCalendarEvents,} from "@/lib/google-calendar";
import { type EventPosition, getEventsFromSheet,} from "@/lib/sheets/events";
import { type NextRequest, NextResponse,} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

type CalendarResponseEvent = {
  googleEventId: string;
  eventId: string;
  title: string;
  start: string;
  end: string;
  location: string;
  position: EventPosition;
};

function getJstMonthRange( year: number, month: number,) {
  const start = new Date( Date.UTC( year, month - 1, 1, ) - JST_OFFSET_MS, );
  const end = new Date( Date.UTC(year,month,1, ) - JST_OFFSET_MS,);
  return {timeMin: start.toISOString(), timeMax: end.toISOString(), };
}

function isValidYearMonth(year: number,month: number,) {
  return (
    Number.isInteger(year) && Number.isInteger(month) && year >= 2000 && year <= 2100 && month >= 1 && month <= 12
  );
}

export async function GET( request: NextRequest,) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "ログインが必要です。", },
        { status: 401, },
      );
    }
    const searchParams = request.nextUrl.searchParams;
    const year = Number( searchParams.get( "year", ), );
    const month = Number( searchParams.get( "month", ),);
    if ( !isValidYearMonth( year, month, ) ) {
      return NextResponse.json(
        { success: false, error: "年月の指定が正しくありません。", },
        { status: 400, },
      );
    }
    const role = session.user.role;
    const canViewExecutive = role === "executive" || role === "admin";
    const requestedPosition = searchParams.get( "position", );
    let position: EventPosition = "general";
    if ( canViewExecutive && requestedPosition === "executive" ) {
      position = "executive";
    }

    const { timeMin, timeMax, } = getJstMonthRange( year, month, );
    const [ googleEvents, sheetEvents, ] = await Promise.all([ 
        listGoogleCalendarEvents({ position, timeMin, timeMax, }), getEventsFromSheet(),
      ]);
    const currentTime = Date.now();

    /*
     * Google側に古い予定が残っていても
     * Eventsシート上で表示対象でなければ
     * 一般会員へ返さない。
     */
    const visibleEventMap = new Map( sheetEvents .filter((event) => {
            const endTime = new Date( event.event_end_date, ).getTime();
            return (
              event.position === position && ( event.status === "published" || event.status === "closed"
              ) && !Number.isNaN( endTime, ) && endTime > currentTime );
          })
          .map( (event) => [ event.event_id, event, ],),
      );
    const responseEvents: CalendarResponseEvent[] = [];
     for ( const googleEvent of googleEvents ) {
      const eventId = googleEvent .extendedProperties ?.private ?.app_event_id ?.trim() ?? "";
      if (!eventId) {
        continue;
      }
      const sheetEvent = visibleEventMap.get( eventId, );
      if (!sheetEvent) {
        continue;
      }
      const start = googleEvent.start ?.dateTime ?? "";
      const end = googleEvent.end ?.dateTime ?? "";
      if ( !start || !end ) {
        continue;
      }
      const endTime = new Date( end, ).getTime();
      if ( Number.isNaN( endTime, ) || endTime <= currentTime ) {
        continue;
      }
      responseEvents.push({ googleEventId: googleEvent.id ?? "",
        eventId,
        title: googleEvent.summary ?.trim() || sheetEvent.title,
        start,
        end,
        location: googleEvent.location ?.trim() || sheetEvent.location,
        position,
      });
    }
    responseEvents.sort( ( eventA, eventB, ) => new Date( eventA.start, ).getTime() - new Date( eventB.start, ).getTime(), );

    return NextResponse.json({
      success: true,
      year,
      month,
      position,
      canViewExecutive,
      events: responseEvents,
    });
  } catch (error) {
    console.error( "Calendar events API error:", error, );
    return NextResponse.json(
      { success: false, error: "カレンダー情報を取得できませんでした。", },
      { status: 500, },
    );
  }
}