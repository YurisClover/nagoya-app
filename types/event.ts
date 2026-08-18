export type EventPosition =
  | "general"
  | "executive";

export type VisibleEventStatus =
  | "published"
  | "closed";

export type EventWithStatus = {
  id: number;
  event_id: string;
  title: string;
  event_date: string;
  event_end_date: string;
  location: string;
  position: EventPosition;
  status: VisibleEventStatus;
  form_url: string;
  prefill_url_template: string;
  is_answered: boolean | null;
};

/**
 * 旧イベント別回答シートの
 * 確認機能で使用している型。
 *
 * 回答同期方式をanswerシート1枚へ
 * 移行した段階で削除を検討する。
 */
export type EventSheetHealth = {
  event_id: string;
  title: string;
  sheet_name: string;
  sheet_found: boolean;
  member_id_column: string | null;
  response_count: number | null;
};