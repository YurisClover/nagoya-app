"use client";

import {
  type SubmitEvent,
  useState,
} from "react";

type CreateEventResult = {
  success: boolean;
  error?: string;
  detail?: string;
  event?: {
    eventId: string;
    title: string;
    eventDate: string;
    location: string;
    status: "private";
    formId: string;
    formUrl: string;
    formEditUrl: string;
  };
};

export function EventCreateForm() {
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [formEditUrl, setFormEditUrl] =
    useState("");

  async function handleSubmit(
    event: SubmitEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formElement =
      event.currentTarget;

    const formData =
      new FormData(formElement);

    const title =
      String(
        formData.get("title") ?? "",
      ).trim();

    const eventDate =
      String(
        formData.get("eventDate") ?? "",
      ).trim();

    const location =
      String(
        formData.get("location") ?? "",
      ).trim();

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
        "イベント日時を入力してください。",
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
        "イベント日時の形式が正しくありません。",
      );
      return;
    }

    /*
     * fetch完了後にwindow.openすると、
     * ポップアップとして止められる場合があるため、
     * ボタンを押した時点で先に空タブを開く。
     */
    const googleFormWindow =
      window.open(
        "about:blank",
        "_blank",
      );

    if (googleFormWindow) {
      googleFormWindow.opener = null;

      googleFormWindow.document.title =
        "Googleフォームを作成しています";

      googleFormWindow.document.body.textContent =
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

            body: JSON.stringify({
              title,

              /*
               * datetime-localの値を
               * ISO形式へ変換して送信する。
               */
              eventDate:
                parsedEventDate.toISOString(),

              location,
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

        setErrorMessage(
          result.error ??
            "イベントの作成に失敗しました。",
        );

        return;
      }

      const editUrl =
        result.event?.formEditUrl;

      if (!editUrl) {
        googleFormWindow?.close();

        setErrorMessage(
          "イベントは作成されましたが、Googleフォームの編集URLを取得できませんでした。",
        );

        return;
      }

      setMessage(
        "イベントを非公開状態で作成しました。",
      );

      setFormEditUrl(editUrl);

      formElement.reset();

      if (googleFormWindow) {
        googleFormWindow.location.href =
          editUrl;
      }
    } catch (error) {
      googleFormWindow?.close();

      console.error(
        "イベント作成エラー:",
        error,
      );

      setErrorMessage(
        "イベント作成中に通信エラーが発生しました。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h2>イベントを作成</h2>

      <p>
        イベント作成後、Googleフォームの編集画面が開きます。
        作成時点ではイベントとフォームの両方が非公開です。
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title">
            イベント名
          </label>

          <input
            id="title"
            name="title"
            type="text"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="eventDate">
            イベント日時
          </label>

          <input
            id="eventDate"
            name="eventDate"
            type="datetime-local"
            required
            disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "作成しています..."
            : "作成してGoogleフォームを編集"}
        </button>
      </form>

      {message && (
        <p role="status">
          {message}
        </p>
      )}

      {errorMessage && (
        <p role="alert">
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