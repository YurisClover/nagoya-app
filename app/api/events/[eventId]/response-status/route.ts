import {
  auth,
} from "@/auth";

import {
  NextResponse,
} from "next/server";

import {
  hasSubmittedEventResponse,
} from "@/lib/event-response-status";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      eventId: string;
    }>;
  },
) {
  try {
    const session =
      await auth();


    if (!session?.user) {
      return NextResponse.json(
        {
          error:
            "ログインが必要です。",
        },
        {
          status: 401,
        },
      );
    }


    const memberId =
      session.user.id?.trim();


    if (!memberId) {
      return NextResponse.json(
        {
          error:
            "会員IDを取得できません。",
        },
        {
          status: 401,
        },
      );
    }


    const {
      eventId,
    } =
      await params;


    const answered =
      await hasSubmittedEventResponse({
        eventId,
        memberId,
      });


    return NextResponse.json(
      {
        answered,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Event response status error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "回答状況を確認できませんでした。",
      },
      {
        status: 500,
      },
    );
  }
}