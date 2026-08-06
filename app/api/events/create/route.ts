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
  configureGoogleFormResponseSheet,
  createGoogleFormPrefillTemplate,
} from "@/lib/google-form-prefill";

import {
  addEventToSheet,
  updateEventResponseSheetInfo,
  type EventPosition,
} from "@/lib/sheets/events";

import {
  formatEventSchedule,
  nowJST,
} from "@/lib/datetime";

export const runtime =
  "nodejs";

type CreateEventRequest = {
  title?: unknown;
  eventDate?: unknown;
  eventEndDate?: unknown;
  location?: unknown;
  position?: unknown;
};

function isEventPosition(
  value: unknown,
): value is EventPosition {
  return (
    value === "general" ||
    value === "executive"
  );
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

    const position =
      body.position === undefined
        ? "general"
        : body.position;

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
      !isEventPosition(
        position,
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
          `開催日時：${formatEventSchedule(
            eventDate,
            eventEndDate,
          )}`,

          location
            ? `開催場所：${location}`
            : null,

          "",
          "※「申込確認コード」の質問はシステムで使用するため、削除・変更しないでください。",
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
        
            title:
              "申込確認コード",

            description:
              "システムによって自動入力されます。この質問は削除・変更しないでください。",

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

    const prefillUrlTemplate =
  await createGoogleFormPrefillTemplate(
    googleForm.formId,
  );

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
        position,

        form_id:
          googleForm.formId,

        form_url:
          googleForm.responderUrl,

        status:
          "draft",

        created_by:
          createdBy,

        created_at:
          nowJST(),

        registration_count:
          0,

          is_deleted:
          false,

         prefill_url_template:
         prefillUrlTemplate,

         response_sheet_name:"",

         response_sheet_id:"",

      });

const responseSheet =
  await configureGoogleFormResponseSheet({
    formId:
      googleForm.formId,

    eventId:
      String(
        createdEvent.event_id,
      ),

    eventTitle:
      title,
  });

await updateEventResponseSheetInfo({
  eventId:
    String(
      createdEvent.event_id,
    ),

  responseSheetName:
    responseSheet.sheetName,

  responseSheetId:
    responseSheet.sheetId,
});

    /*
     * ⑥ 管理画面へ結果を返す
     */
    return NextResponse.json(
      {
        success: true,

        message:
          "イベントを準備中の状態で作成しました。",

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

          position:
            createdEvent.position,

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