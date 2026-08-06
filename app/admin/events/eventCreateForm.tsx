"use client";

import {
  type SubmitEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import SyncEventResponsesButton
  from "@/components/SyncEventResponsesButton";

type EventPosition =
  | "general"
  | "executive";

type CreateEventResult = {
  success: boolean;
  error?: string;
  detail?: string;

  event?: {
    eventId: string;
    title: string;
    eventDate: string;
    eventEndDate: string;
    location: string;
    position: EventPosition;
    status: "draft";
    formId: string;
    formUrl: string;
    formEditUrl: string;
  };
};

export function EventCreateForm() {
  const router =
    useRouter();

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    formEditUrl,
    setFormEditUrl,
  ] = useState("");

  async function handleSubmit(
    event:
      SubmitEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formElement =
      event.currentTarget;

    const formData =
      new FormData(
        formElement,
      );

    const title =
      String(
        formData.get("title") ??
          "",
      ).trim();

    const eventDate =
      String(
        formData.get(
          "eventDate",
        ) ?? "",
      ).trim();

    const eventEndDate =
      String(
        formData.get(
          "eventEndDate",
        ) ?? "",
      ).trim();

    const location =
      String(
        formData.get(
          "location",
        ) ?? "",
      ).trim();

    const positionValue =
      String(
        formData.get(
          "position",
        ) ?? "general",
      );

    const position:
    EventPosition =
      positionValue ===
      "executive"
        ? "executive"
        : "general";

    setMessage("");
    setErrorMessage("");
    setFormEditUrl("");

    if (!title) {
      setErrorMessage(
        "イベント名を入力してください。",
      );

      return;
    }

    if (!eventDate) {
      setErrorMessage(
        "開始日時を入力してください。",
      );

      return;
    }

    if (!eventEndDate) {
      setErrorMessage(
        "終了日時を入力してください。",
      );

      return;
    }

    const parsedEventDate =
      new Date(eventDate);

    if (
      Number.isNaN(
        parsedEventDate.getTime(),
      )
    ) {
      setErrorMessage(
        "開始日時の形式が正しくありません。",
      );

      return;
    }

    const parsedEventEndDate =
      new Date(
        eventEndDate,
      );

    if (
      Number.isNaN(
        parsedEventEndDate.getTime(),
      )
    ) {
      setErrorMessage(
        "終了日時の形式が正しくありません。",
      );

      return;
    }

    if (
      parsedEventEndDate.getTime() <=
      parsedEventDate.getTime()
    ) {
      setErrorMessage(
        "終了日時は開始日時より後に設定してください。",
      );

      return;
    }

    /*
     * API完了後にwindow.openすると
     * ブラウザに止められる場合があるため、
     * クリック直後に空タブを開く。
     */
    const googleFormWindow =
      window.open(
        "about:blank",
        "_blank",
      );

    if (googleFormWindow) {
      googleFormWindow.opener =
        null;

      googleFormWindow.document.title =
        "Googleフォームを作成しています";

      googleFormWindow.document
        .body.textContent =
        "Googleフォームを作成しています。";
    }

    setIsSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/events/create",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                title,

                /*
                 * datetime-localの値を
                 * ISO形式へ変換して送る。
                 */
                eventDate:
                  parsedEventDate
                    .toISOString(),

                eventEndDate:
                  parsedEventEndDate
                    .toISOString(),

                location,
                position,
              }),
          },
        );

      const result =
        (await response.json()) as
          CreateEventResult;

      if (
        !response.ok ||
        !result.success
      ) {
        googleFormWindow?.close();

        const errorText = [
          result.error ??
            "イベントの作成に失敗しました。",

          result.detail
            ? `詳細: ${result.detail}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        setErrorMessage(
          errorText,
        );

        return;
      }

      const editUrl =
        result.event
          ?.formEditUrl;

      if (!editUrl) {
        googleFormWindow?.close();

        setErrorMessage(
          "イベントは作成されましたが、Googleフォームの編集URLを取得できませんでした。",
        );

        return;
      }

      setMessage(
        "イベントを準備中の状態で作成しました。",
      );

      setFormEditUrl(
        editUrl,
      );

      formElement.reset();

      /*
       * 元のイベント管理画面へ
       * 新しいイベント一覧を反映する。
       */
      router.refresh();

      if (googleFormWindow) {
        googleFormWindow
          .location.href =
          editUrl;
      }
    } catch (error) {
      googleFormWindow?.close();

      console.error(
        "イベント作成エラー:",
        error,
      );

      const detail =
        error instanceof Error
          ? error.message
          : "不明な通信エラー";

      setErrorMessage(
        `イベント作成中に通信エラーが発生しました。\n詳細: ${detail}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h2>
        イベントを作成
      </h2>

      <p>
        イベント作成後、Googleフォームの編集画面が開きます。
        作成時点ではイベントは準備中で、Googleフォームは非公開・受付停止です。
      </p>

      <form
        onSubmit={handleSubmit}
      >
        <div>
          <label htmlFor="title">
            イベント名
          </label>

          <input
            id="title"
            name="title"
            type="text"
            required
            disabled={
              isSubmitting
            }
          />
        </div>

        <div>
          <label htmlFor="eventDate">
            開始日時
          </label>

          <input
            id="eventDate"
            name="eventDate"
            type="datetime-local"
            required
            disabled={
              isSubmitting
            }
          />
        </div>

        <div>
          <label htmlFor="eventEndDate">
            終了日時
          </label>

          <input
            id="eventEndDate"
            name="eventEndDate"
            type="datetime-local"
            required
            disabled={
              isSubmitting
            }
          />
        </div>

        <div>
          <label htmlFor="location">
            開催場所
          </label>

          <input
            id="location"
            name="location"
            type="text"
            disabled={
              isSubmitting
            }
          />
        </div>

        <div>
          <label htmlFor="position">
            イベント対象者
          </label>

          <select
            id="position"
            name="position"
            defaultValue="general"
            disabled={
              isSubmitting
            }
          >
            <option value="general">
              一般会員向け
            </option>

            <option value="executive">
              執行部向け
            </option>
          </select>
        </div>

        <button
          type="submit"
          disabled={
            isSubmitting
          }
        >
          {isSubmitting
            ? "作成しています..."
            : "作成してGoogleフォームを編集"}
        </button>
      </form>

      <div className="mt-4">
        <SyncEventResponsesButton />
      </div>

      {message && (
        <p role="status">
          {message}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          style={{
            whiteSpace:
              "pre-wrap",
          }}
        >
          {errorMessage}
        </p>
      )}

      {formEditUrl && (
        <p>
          編集画面が開かなかった場合：
          {" "}

          <a
            href={formEditUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Googleフォームを編集
          </a>
        </p>
      )}
    </section>
  );
}