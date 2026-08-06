"use client";

import {
  useState,
} from "react";

type SyncResult = {
  processed: number;
  valid: number;
  invalid: number;
  skipped: number;
  answerInserted: number;
  answerUpdated: number;
  registrationCountsUpdated: number;
};

export default function SyncEventResponsesButton() {
  const [
    isSyncing,
    setIsSyncing,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    isError,
    setIsError,
  ] = useState(false);

  async function handleSync() {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    setMessage("");
    setIsError(false);

    try {
      const response =
        await fetch(
          "/api/events/sync-responses",
          {
            method: "POST",
          },
        );

      const body:
        | SyncResult
        | {
            error?: string;
          } =
        await response.json();

      if (!response.ok) {
        throw new Error(
          "error" in body &&
          body.error
            ? body.error
            : "回答同期に失敗しました。",
        );
      }

      const result =
        body as SyncResult;

        setMessage(
           [
             "回答を同期しました。",
             `新規登録：${result.answerInserted}件`,
             `更新：${result.answerUpdated}件`,
             `申込数更新：${result.registrationCountsUpdated}イベント`,
             `有効：${result.valid}件`,
             `無効：${result.invalid}件`,
           ].join(" "),
          );


    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "回答同期に失敗しました。",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
        className={[
          "rounded-md px-4 py-2",
          "font-medium text-white",
          isSyncing
            ? "cursor-not-allowed bg-gray-400"
            : "bg-blue-600 hover:bg-blue-700",
        ].join(" ")}
      >
        {isSyncing
          ? "同期中..."
          : "回答を同期"}
      </button>

      {message && (
        <p
          className={[
            "mt-2 text-sm",
            isError
              ? "text-red-600"
              : "text-green-700",
          ].join(" ")}
        >
          {message}
        </p>
      )}
    </div>
  );
}