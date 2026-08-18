"use client";

export function EventCreateTestButton() {

  async function handleTest() {
  // ボタンを押した瞬間に空のタブを開く
  const formEditWindow = window.open(
    "about:blank",
    "_blank",
  );

  if (formEditWindow) {
    formEditWindow.opener = null;
    formEditWindow.document.title =
      "Googleフォームを作成しています";
  }

  try {
    const response = await fetch(
      "/api/events/create",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          title:
            "本番イベント作成テスト",
          eventDate:
            "2026-08-15T10:00:00+09:00",
          location:
            "名古屋市内",
        }),
      },
    );

    const result = await response.json();

    console.log(
      "イベント作成結果:",
      result,
    );

    if (!response.ok) {
      formEditWindow?.close();

      alert(
        result.error ??
          "イベントの作成に失敗しました。",
      );

      return;
    }

    const formEditUrl =
      result.event?.formEditUrl;

    if (formEditUrl) {
      if (formEditWindow) {
        // 先に開いた空タブを編集画面へ移動
        formEditWindow.location.href =
          formEditUrl;
      } else {
        // ポップアップ自体が許可されなかった場合
        window.location.href =
          formEditUrl;
      }
    } else {
      formEditWindow?.close();

      alert(
        "イベントは作成されましたが、Googleフォームの編集URLを取得できませんでした。",
      );
    }
  } catch (error) {
    formEditWindow?.close();

    console.error(
      "イベント作成テストエラー:",
      error,
    );

    alert(
      "通信中にエラーが発生しました。",
    );
  }
}

  return (
    <button
      type="button"
      onClick={handleTest}
    >
      イベント作成APIをテスト
    </button>
  );
}