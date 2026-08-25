/**
 * イベントの並び順(共通ロジック)
 *
 * ルール: 「開始日が今日に近い順」
 *   1. 開催前・開催中のイベント … 開始日の昇順(直近の開催が先頭)
 *      ※「終了日(なければ開始日)が今日以降」で判定する。開始日で判定すると
 *        複数日開催で今まさに開催中のイベントが「過去」扱いになり下に沈むため。
 *   2. 終了済みのイベント … 開始日の降順(最近終わったものが先)
 *   3. 日付が読めない行 … 最後尾
 *
 * 日付の解釈はチーム共通の parseSheetDate に一本化する(JST 基準・複数形式対応)。
 * admin 側(lib/sheets/events.ts)と会員側(lib/events.ts)の両方から使うこと。
 * 並び順を変えるときはこのファイルだけを直せば両画面に反映される。
 */
import { parseSheetDate } from "@/lib/datetime";

export type OrderableEvent = {
  event_date?: string | null;
  event_end_date?: string | null;
};

/** 並べ替え用タイムスタンプ。読めなければ NaN。 */
function timeKey(value: string | null | undefined): number {
  const parsed = parseSheetDate(String(value ?? ""));
  return parsed ? parsed.getTime() : Number.NaN;
}

/**
 * @param todayJst nowJST().slice(0, 10) の "YYYY-MM-DD"(JST基準の今日)
 */
export function compareByNearestStart(todayJst: string) {
  // 「今日の0時(JST)」より前に終わったものを「終了済み」とみなす。
  // 時刻まで見ないのは、当日のイベントを一日中「開催中」扱いにするため。
  const todayStart = timeKey(todayJst);

  const bucket = (event: OrderableEvent): number => {
    const start = timeKey(event.event_date);
    if (Number.isNaN(start)) return 2; // 日付不明 → 最後尾
    const end = timeKey(event.event_end_date);
    const effectiveEnd = Number.isNaN(end) ? start : end;
    return effectiveEnd >= todayStart ? 0 : 1; // 0: 開催前・開催中 / 1: 終了済み
  };

  return (a: OrderableEvent, b: OrderableEvent): number => {
    const bucketA = bucket(a);
    const bucketB = bucket(b);
    if (bucketA !== bucketB) return bucketA - bucketB;

    const timeA = timeKey(a.event_date);
    const timeB = timeKey(b.event_date);
    if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;

    // 開催前・開催中は昇順(直近が先頭)、終了済みは降順(最近終わったものが先)
    return bucketA === 0 ? timeA - timeB : timeB - timeA;
  };
}
