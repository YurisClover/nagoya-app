import { auth } from "@/auth";

import { type NextRequest, NextResponse } from "next/server";

import { type EventPosition, updateEventPosition } from "@/lib/sheets/events";

import { syncEventPositionCalendar } from "@/lib/event-calendar-sync";

export const runtime = "nodejs";

type UpdatePositionRequest = {
  eventId?: unknown;
  position?: unknown;
};

function isEventPosition(value: unknown): value is EventPosition {
  return value === "general" || value === "executive";
}

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
          error: "イベント対象者を変更する権限がありません。",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as UpdatePositionRequest;

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

    if (!isEventPosition(body.position)) {
      return NextResponse.json(
        {
          success: false,
          error: "イベント対象者の指定が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    // const updatedEvent = await updateEventPosition(eventId, body.position);

    // return NextResponse.json({
    //   success: true,
    //   message: "イベント対象者を変更しました。",
    //   event: updatedEvent,
    // });
    const updatedEvent = await updateEventPosition(eventId, body.position);
    const calendarSyncResult = await syncEventPositionCalendar(updatedEvent);

    /*
     * Googleカレンダーの同期に失敗しても、
     * イベント対象者の変更自体は取り消さない。
     */
    return NextResponse.json({
      success: true,
      message: calendarSyncResult.success
        ? "イベント対象者を変更しました。"
        : "イベント対象者を変更しましたが、Googleカレンダーとの同期に失敗しました。",
      event: updatedEvent,
      calendarSync: {
        success: calendarSyncResult.success,
        error: calendarSyncResult.error,
      },
    });
  } catch (error) {
    console.error("Event position update error:", error);
    const detail =
      error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json(
      {
        success: false,
        error: "イベント対象者の変更に失敗しました。",
        detail,
      },
      {
        status: 500,
      },
    );
  }
}
