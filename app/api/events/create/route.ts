import { randomUUID } from "crypto";
import {auth} from "@/auth";

import {type NextRequest,NextResponse,} from "next/server";

import {
  createEventGoogleForm,
} from "@/lib/google-forms";

import {
  addEventToSheet,
} from "@/lib/sheets/events";

import {
  nowJST,
} from "@/lib/datetime";

export const runtime = "nodejs";

type CreateEventRequest = {
  title?: unknown;
  eventDate?: unknown;
  location?: unknown;
};

/**
 * Googleフォームの説明欄に表示する日付を整形する
 */
function formatEventDate(
  eventDate: string,
): string {
  const date = new Date(eventDate);

  if (
    Number.isNaN(date.getTime())
  ) {
    return eventDate;
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
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
    const session = await auth();

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

    /*
     * session.user.idにはUsersシートのmember_idが入っている
     * 現在のNextAuth設定に合わせる。
     */
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

    const location =
      typeof body.location === "string"
        ? body.location.trim()
        : "";

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
            "イベント日時を入力してください。",
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
            "イベント日時の形式が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ④ 非公開のGoogleフォームを作成
     *
     * 質問はGoogleフォームの編集画面で
     * 管理者が作成するため空配列。
     */
    const googleForm =
      await createEventGoogleForm({
        title:
          `${title} 申込フォーム`,

        description: [
          `開催日時：${formatEventDate(eventDate)}`,
          location
            ? `開催場所：${location}`
            : null,
        ]
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          )
          .join("\n"),

        questions: [],
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
     */
    const eventId =
      randomUUID();

    await addEventToSheet({
      event_id: eventId,
      title,
      event_date: eventDate,
      location,

      form_id:
        googleForm.formId,

      form_url:
        googleForm.responderUrl,

      // 初期値は必ず非公開
      status: "private",

      // クライアントから受け取らず
      // ログイン中のユーザーを使用
      created_by: createdBy,

      created_at: nowJST(),

      registration_count: 0,
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
          eventId,
          title,
          eventDate,
          location,
          status: "private",

          formId:
            googleForm.formId,

          formUrl:
            googleForm.responderUrl,

          /*
           * 管理画面はこのURLを
           * 新しいタブで開く
           */
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

        /*
         * Sheets保存で失敗した場合、
         * Driveにフォームだけ残っている可能性を
         * ログで確認できるようにする。
         */
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