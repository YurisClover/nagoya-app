import { auth } from "@/auth";
import { getEventsData } from "@/lib/events";
import type { EventPosition } from "@/types/event";
import { type NextRequest, NextResponse } from "next/server";
import { getEventResponseStatusMap } from "@/lib/event-response-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "ログインが必要です。",
        },
        {
          status: 401,
        },
      );
    }

    const role = session.user.role;

    const requestedPosition = request.nextUrl.searchParams.get("position");

    let position: EventPosition = "general";

    /*
     * executive・adminだけが
     * 執行部向けイベントを取得できる。
     *
     * generalユーザーがURLを直接変更しても
     * generalイベントのみ返す。
     */
    if (role === "executive" || role === "admin") {
      position = requestedPosition === "executive" ? "executive" : "general";
    }

    //   const data =
    // await getEventsData(
    //   {
    //     memberId:
    //       session.user.id ||
    //       undefined,

    //     role:
    //       session.user.role ||
    //       undefined,
    //   },
    //   position,
    // );

    //   return NextResponse.json(
    //     data,
    //   );
    const memberId = session.user.id?.trim();

    const data = await getEventsData(
      { role: session.user.role || undefined },
      position,
    );

    if (!memberId) {
      return NextResponse.json(data);
    }

    let responseStatusMap: Map<string, boolean> | null = null;
    try {
        responseStatusMap = await getEventResponseStatusMap({
            eventIds: data.map((event) => event.event_id),
            memberId,
        });
    } catch (statusError) {
        console.error("Failed to fetch response status:", statusError);
    }
    
    const dataWithResponseStatus = data.map((event) => ({
      ...event,

      is_answered: responseStatusMap ? (responseStatusMap.get(event.event_id) ?? false) : null,
    }));

    return NextResponse.json(dataWithResponseStatus);
  } catch (error) {
    console.error("User events API error:", error);

    return NextResponse.json(
      {
        error: "イベント情報を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }
}
