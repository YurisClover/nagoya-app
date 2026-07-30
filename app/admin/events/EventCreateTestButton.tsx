"use client";

export function EventCreateTestButton() {
  async function handleTest() {
    try {
      const response = await fetch("/api/events/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "本番イベント作成テスト",
          eventDate: "2026-08-15T10:00:00+09:00",
          location: "名古屋市内",
        }),
      });

      const result = await response.json();

      console.log("イベント作成結果:", result);

      if (!response.ok) {
        alert(
          result.error ??
            "イベントの作成に失敗しました。",
        );
        return;
      }

      alert("イベントを作成しました。");

      if (result.event?.formEditUrl) {
        window.open(
          result.event.formEditUrl,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (error) {
      console.error("イベント作成テストエラー:", error);
      alert("通信中にエラーが発生しました。");
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