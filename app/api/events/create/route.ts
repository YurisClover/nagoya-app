import {
  auth,
} from "@/auth";

import {
  type NextRequest,
  NextResponse,
} from "next/server";

import {
  createEventGoogleForm,
} from "@/lib/google-forms";

import {
  addEventToSheet,
  type EventAudience,
} from "@/lib/sheets/events";

import {
  nowJST,
} from "@/lib/datetime";

export const runtime =
  "nodejs";

type CreateEventRequest = {
  title?: unknown;
  eventDate?: unknown;
  eventEndDate?: unknown;
  location?: unknown;
  audience?: unknown;
};

function isEventAudience(
  value: unknown,
): value is EventAudience {
  return (
    value === "general" ||
    value === "executive"
  );
}

/**
 * 開始日時と終了日時を表示用に整形する。
 *
 * 同じ日：
 * 2026年8月15日(土) 16:00〜21:00
 *
 * 日をまたぐ：
 * 2026年8月15日(土) 22:00〜8月16日(日) 02:00
 */
function formatEventPeriod(
  eventDate: string,
  eventEndDate: string,
): string {
  const startDate =
    new Date(eventDate);

  const endDate =
    new Date(eventEndDate);

  if (
    Number.isNaN(
      startDate.getTime(),
    ) ||
    Number.isNaN(
      endDate.getTime(),
    )
  ) {
    return `${eventDate}〜${eventEndDate}`;
  }

  const fullDateFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      },
    );

  const shortDateFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",
        month: "long",
        day: "numeric",
        weekday: "short",
      },
    );

  const timeFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    );

  const dateKeyFormatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );

  const startDateText =
    fullDateFormatter.format(
      startDate,
    );

  const startTimeText =
    timeFormatter.format(
      startDate,
    );

  const endTimeText =
    timeFormatter.format(
      endDate,
    );

  const isSameDay =
    dateKeyFormatter.format(
      startDate,
    ) ===
    dateKeyFormatter.format(
      endDate,
    );

  if (isSameDay) {
    return `${startDateText} ${startTimeText}〜${endTimeText}`;
  }

  const endDateText =
    shortDateFormatter.format(
      endDate,
    );

  return `${startDateText} ${startTimeText}〜${endDateText} ${endTimeText}`;
}

export async function POST(
  request: NextRequest,
) {
  let createdFormId:
    | string
    | null = null;

  try {
    /*
     * ① ログイン中の利用者を取得
     */
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

    const createdBy =
      session.user.id;

    const role =
      session.user.role;

    if (!createdBy) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ログインユーザーの会員IDを取得できませんでした。",
        },
        {
          status: 401,
        },
      );
    }

    if (
      role !== "admin" &&
      role !== "executive"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "イベントを作成する権限がありません。",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ② 管理画面から送られた内容を取得
     */
    const body =
      (await request.json()) as
        CreateEventRequest;

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const eventDate =
      typeof body.eventDate === "string"
        ? body.eventDate.trim()
        : "";

    const eventEndDate =
      typeof body.eventEndDate === "string"
        ? body.eventEndDate.trim()
        : "";

    const location =
      typeof body.location === "string"
        ? body.location.trim()
        : "";

    const audience =
      body.audience === undefined
        ? "general"
        : body.audience;

    /*
     * ③ 入力チェック
     */
    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error:
            "イベント名を入力してください。",
        },
        {
          status: 400,
        },
      );
    }

    if (!eventDate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "開始日時を入力してください。",
        },
        {
          status: 400,
        },
      );
    }

    if (!eventEndDate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "終了日時を入力してください。",
        },
        {
          status: 400,
        },
      );
    }

    const parsedEventDate =
      new Date(eventDate);

    if (
      Number.isNaN(
        parsedEventDate.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "開始日時の形式が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    const parsedEventEndDate =
      new Date(eventEndDate);

    if (
      Number.isNaN(
        parsedEventEndDate.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "終了日時の形式が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    if (
      parsedEventEndDate.getTime() <=
      parsedEventDate.getTime()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "終了日時は開始日時より後に設定してください。",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !isEventAudience(
        audience,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "イベント対象者の指定が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ④ 非公開のGoogleフォームを作成
     */
    const googleForm =
      await createEventGoogleForm({
        title:
          `${title} 申込フォーム`,

        description: [
          `開催日時：${formatEventPeriod(
            eventDate,
            eventEndDate,
          )}`,

          location
            ? `開催場所：${location}`
            : null,

          "",
          "※「会員ID」の質問はシステムで使用するため、削除しないでください。",
        ]
          .filter(
            (
              value,
            ): value is string =>
              value !== null,
          )
          .join("\n"),

        questions: [
          {
            /*
             * 回答同期時に会員ID回答を
             * 特定するための固定質問ID。
             */
            questionId:
              "memberId",

            title:
              "会員ID",

            description:
              "ログイン中の会員IDが自動入力されます。この質問は削除しないでください。",

            required:
              true,

            type:
              "SHORT_TEXT",
          },
        ],
      });

    createdFormId =
      googleForm.formId;

    if (
      !googleForm.responderUrl
    ) {
      throw new Error(
        "Googleフォームの回答用URLを取得できませんでした。",
      );
    }

    /*
     * ⑤ Eventsシートへ保存
     *
     * event_idはaddEventToSheet()内で
     * 最大値+1として発行する。
     */
    const createdEvent =
      await addEventToSheet({
        title,

        event_date:
          eventDate,

        event_end_date:
          eventEndDate,

        location,
        audience,

        form_id:
          googleForm.formId,

        form_url:
          googleForm.responderUrl,

        status:
          "private",

        created_by:
          createdBy,

        created_at:
          nowJST(),

        registration_count:
          0,
      });

    /*
     * ⑥ 管理画面へ結果を返す
     */
    return NextResponse.json(
      {
        success: true,

        message:
          "イベントを非公開状態で作成しました。",

        event: {
          eventId:
            createdEvent.event_id,

          title:
            createdEvent.title,

          eventDate:
            createdEvent.event_date,

          eventEndDate:
            createdEvent.event_end_date,

          location:
            createdEvent.location,

          audience:
            createdEvent.audience,

          status:
            createdEvent.status,

          formId:
            createdEvent.form_id,

          formUrl:
            createdEvent.form_url,

          formEditUrl:
            googleForm.editUrl,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Event creation error:",
      {
        error,
        createdFormId,
      },
    );

    const detail =
      error instanceof Error
        ? error.message
        : "不明なエラーが発生しました。";

    return NextResponse.json(
      {
        success: false,

        error:
          "イベントの作成に失敗しました。",

        detail,
      },
      {
        status: 500,
      },
    );
  }
}