import {
  auth,
} from "@/auth";

import {
  type NextRequest,
  NextResponse,
} from "next/server";

import {
  setGoogleFormStatus,
  type GoogleFormStatus,
} from "@/lib/google-forms";

import {
  type EventStatus,
  updateEventStatus,
} from "@/lib/sheets/events";

export const runtime =
  "nodejs";

type UpdateEventStatusRequest = {
  eventId?: unknown;
  status?: unknown;
};

function isEventStatus(
  value: unknown,
): value is EventStatus {
  return (
    value === "private" ||
    value === "published" ||
    value === "closed"
  );
}

function convertToGoogleFormStatus(
  status: EventStatus,
): GoogleFormStatus {
  if (
    status === "published"
  ) {
    return "open";
  }

  return status;
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    const session =
      await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ログインが必要です。",
        },
        {
          status: 401,
        },
      );
    }

    const role =
      session.user.role;

    if (
      role !== "admin" &&
      role !== "executive"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "イベントの状態を変更する権限がありません。",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      (await request.json()) as
        UpdateEventStatusRequest;

    const eventId =
      typeof body.eventId ===
      "string"
        ? body.eventId.trim()
        : "";

    if (!eventId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "イベントIDが指定されていません。",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !isEventStatus(
        body.status,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "公開状態の指定が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    const status =
      body.status;

    const updatedEvent =
      await updateEventStatus(
        eventId,
        status,

        async (formId) => {
          await setGoogleFormStatus(
            formId,
            convertToGoogleFormStatus(
              status,
            ),
          );
        },
      );

    return NextResponse.json({
      success: true,

      message:
        "イベントの公開状態を変更しました。",

      event: updatedEvent,
    });
  } catch (error) {
    console.error(
      "Event status update error:",
      error,
    );

    const detail =
      error instanceof Error
        ? error.message
        : "不明なエラーが発生しました。";

    return NextResponse.json(
      {
        success: false,
        error:
          "イベントの公開状態を変更できませんでした。",
        detail,
      },
      {
        status: 500,
      },
    );
  }
}