import "server-only";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
import type { EventWithStatus } from "@/types/event";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];
const PARTICIPANT_MEMBER_ID_COLUMN = "会員IDをご記入ください。";
const TTL_MS = 60_000; // キャッシュの有効期限（60秒）

type EventItem = Omit<EventWithStatus, "is_answered">;
type Snapshot = {
  events: EventItem[];
  // タイトル → 解答済み会員IDのSet | null = シートの読み込み失敗 | キーなし = シートが存在しない
  answers: Map<string, Set<string> | null>;
};

let cached: { data: Snapshot; expires: number } | null = null;
let inflight: Promise<Snapshot> | null = null;

/**
 * スプレッドシートの日付文字列を Date オブジェクトに変換する
 */
function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? parseInt(timeMatch[1], 10) : 0;
  const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;
  
  const withYear = dateStr.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
  if (withYear) return new Date(+withYear[1], +withYear[2] - 1, +withYear[3], hour, minute);
  
  const md = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
  if (!md) return null;
  
  const month = +md[1] - 1;
  const day = +md[2];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let d = new Date(now.getFullYear(), month, day, hour, minute);
  
  // 過去の日付になっている場合は来年の日付として扱う
  if (d < today) d = new Date(now.getFullYear() + 1, month, day, hour, minute);
  return d;
}

/**
 * スプレッドシートからデータを読み込む（TTL内に1回だけ実行し、全ユーザーで共有する）
 */
async function loadSnapshot(): Promise<Snapshot> {
  const { client_email, private_key } = getServiceAccountCredentials();
  const auth = new JWT({ email: client_email, key: private_key, scopes: SHEETS_SCOPE });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);

  await doc.loadInfo(); // 1回目の読み込み（全体情報）
  const eventRows = await doc.sheetsByTitle["Events"].getRows(); // 2回目の読み込み（イベント一覧）

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 本日以降のイベントを抽出し、日付順にソートする
  const upcoming = eventRows
    .map((row, index) => ({
      id: index,
      title: (row.get("title") || "タイトル未設定") as string,
      event_date: (row.get("event_date") || "") as string,
      form_url: (row.get("form_url") || "#") as string,
      _dateObj: parseEventDate(row.get("event_date") || ""),
    }))
    .filter((e): e is typeof e & { _dateObj: Date } => e._dateObj !== null && e._dateObj >= today)
    .sort((a, b) => a._dateObj.getTime() - b._dateObj.getTime());

  // 各イベントごとの回答者一覧を一度に読み込み、メモリ上に Set として保持する
  const answers = new Map<string, Set<string> | null>();
  await Promise.all(
    upcoming.map(async (e) => {
      const sheet = doc.sheetsByTitle[e.title];
      if (!sheet) return; // シートが存在しない場合は誰も回答していないとみなす
      try {
        const rows = await sheet.getRows(); // 3〜N回目の読み込み（各イベントの回答一覧）
        const ids = new Set(
          rows.map((r) => String(r.get(PARTICIPANT_MEMBER_ID_COLUMN) || "").trim()).filter(Boolean)
        );
        answers.set(e.title, ids);
      } catch {
        answers.set(e.title, null); // 読み込みエラーの場合はステータス不明とする
      }
    })
  );

  return { events: upcoming.map(({ _dateObj, ...rest }) => rest), answers };
}

/**
 * キャッシュと同時実行制御（シングルフライト）を管理する
 */
async function getSnapshot(): Promise<Snapshot> {
  if (cached && cached.expires > Date.now()) return cached.data;
  if (inflight) return inflight;
  
  inflight = loadSnapshot()
    .then((data) => {
      cached = { data, expires: Date.now() + TTL_MS };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
    
  return inflight;
}

/**
 * メモリ上のデータからユーザーごとの結果を組み立てる（APIコールは 0 回）
 */
function buildResult(snap: Snapshot, memberId?: string): EventWithStatus[] {
  const target = memberId ? String(memberId).trim() : "";
  return snap.events.map((e) => {
    let is_answered: boolean | null = false;
    if (target) {
      const ids = snap.answers.get(e.title);
      is_answered = ids === null ? null : (ids?.has(target) ?? false);
    }
    return { ...e, is_answered };
  });
}

/**
 * イベントデータを取得するメイン関数
 */
export async function getEventsData(memberId?: string): Promise<EventWithStatus[]> {
  try {
    return buildResult(await getSnapshot(), memberId);
  } catch (error) {
    // シートの読み込み失敗やAPI制限（429）が発生した場合は、過去のキャッシュでフォールバックする
    if (cached) return buildResult(cached.data, memberId);
    throw error;
  }
}