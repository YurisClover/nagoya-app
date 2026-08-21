import { auth } from "@/auth";

import { type NextRequest, NextResponse } from "next/server";

import { setGoogleFormStatus } from "@/lib/google-forms";

import { softDeleteEvent } from "@/lib/sheets/events";

import { removeEventCalendar,} from "@/lib/event-calendar-sync";

export const runtime = "nodejs";

type DeleteEventRequest = {
  eventId?: unknown;
};

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "ログインが必要です。",
        },
        {
          status: 401,
        },
      );
    }

    const role = session.user.role;

    if (role !== "admin" && role !== "executive") {
      return NextResponse.json(
        {
          success: false,
          error: "イベントを削除する権限がありません。",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as DeleteEventRequest;

    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";

    if (!eventId) {
      return NextResponse.json(
        {
          success: false,
          error: "イベントIDが指定されていません。",
        },
        {
          status: 400,
        },
      );
    }

    const deletedEvent = await softDeleteEvent(
      eventId,

      async (formId) => {
        await setGoogleFormStatus(formId, "private");
      },
    );

    const calendarSyncResult = await removeEventCalendar(  deletedEvent.event_id, );

/*
 * Googleカレンダーからの削除に失敗しても、
 * イベントの論理削除自体は取り消さない。
 */
return NextResponse.json({ success: true,

  message: calendarSyncResult.success ? "イベントを削除しました。" : "イベントを削除しましたが、Googleカレンダーからの削除に失敗しました。",
  event: deletedEvent,
  calendarSync: { success: calendarSyncResult.success, error: calendarSyncResult.error, },
});
  } catch (error) {
    console.error("Event delete error:", error);
    const detail = error instanceof Error ? error.message : "不明なエラーが発生しました。";

    return NextResponse.json(
      {
        success: false,
        error: "イベントの削除に失敗しました。",
        detail,
      },
      {
        status: 500,
      },
    );
  }
}
