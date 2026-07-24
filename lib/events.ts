import "server-only";
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
import type { EventWithStatus, EventSheetHealth } from "@/types/event";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];
const TTL_MS = 60_000;

const MEMBER_ID_HEADERS = [
  "会員IDをご記入ください。",
  "会員番号をご記入ください。",
  "会員番号を記入してください。",
  "会員ID",
  "会員番号",
];

function resolveMemberIdHeader(headers: string[]): string | null {
  for (const c of MEMBER_ID_HEADERS) if (headers.includes(c)) return c;
  return headers.find((h) => h.includes("会員") && (/ID/i.test(h) || h.includes("番号"))) ?? null;
}

function normalizeMemberId(v: unknown): string {
  return String(v ?? "").trim().replace(/\.0+$/, "");
}

function resolveSheetName(row: { get: (k: string) => unknown }): string {
  const explicit = String(row.get("response_sheet") ?? "").trim();
  return explicit || String(row.get("title") ?? "").trim();
}

/**
 * 表示用の日付文字列を整形する関数
 * - 日をまたがない場合: 2026/8/10(月) 15:00~20:00 のように後ろの重複する日付を削る
 * - 日をまたぐ場合: 2026/8/10(月) 9:00~2026/8/11(火)20:00 のままフル表示する
 */
function formatEventDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split(/[~～]/);
  if (parts.length < 2) return dateStr;

  const startPart = parts[0].trim();
  const endPart = parts[1].trim();

  if (/^\d{1,2}:\d{2}$/.test(endPart)) {
    return `${startPart}~${endPart}`;
  }

  const startMatch = startPart.match(/^(\d{4}[/-]\d{1,2}[/-]\d{1,2})/);
  const endMatch = endPart.match(/^(\d{4}[/-]\d{1,2}[/-]\d{1,2}).*?(\d{1,2}):(\d{2})$/);

  if (startMatch && endMatch) {
    const startDate = startMatch[1];
    const endDate = endMatch[1];
    const endTime = endMatch[2];

    if (startDate === endDate) {
      return `${startPart}~${endTime}`;
    }
  }

  return dateStr;
}

/**
 * スプレッドシートの日付文字列を解析して Date オブジェクト（開始・終了）に変換する
 */
function parseEventDateTime(dateStr: string): { start: Date; end: Date } | null {
  if (!dateStr) return null;

  const parts = dateStr.split(/[~～]/);
  if (parts.length === 0) return null;

  const startPart = parts[0].trim();
  const endPart = parts[1] ? parts[1].trim() : "";

  const parseSingle = (str: string, baseYear?: number) => {
    const withYear = str.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2}).*?(\d{1,2}):(\d{2})/);
    if (withYear) {
      return new Date(
        parseInt(withYear[1], 10),
        parseInt(withYear[2], 10) - 1,
        parseInt(withYear[3], 10),
        parseInt(withYear[4], 10),
        parseInt(withYear[5], 10)
      );
    }

    const md = str.match(/(\d{1,2})[/-](\d{1,2}).*?(\d{1,2}):(\d{2})/);
    if (md) {
      const now = new Date();
      const year = baseYear ?? now.getFullYear();
      const month = parseInt(md[1], 10) - 1;
      const day = parseInt(md[2], 10);
      const hour = parseInt(md[3], 10);
      const minute = parseInt(md[4], 10);
      let d = new Date(year, month, day, hour, minute);
      if (!baseYear && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        d = new Date(year + 1, month, day, hour, minute);
      }
      return d;
    }
    return null;
  };

  const startDate = parseSingle(startPart);
  if (!startDate) return null;

  let endDate: Date;
  if (!endPart) {
    endDate = new Date(startDate);
  } else if (/^\d{1,2}:\d{2}$/.test(endPart)) {
    const [h, m] = endPart.split(":").map(Number);
    endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      h,
      m
    );
  } else {
    const parsedEnd = parseSingle(endPart, startDate.getFullYear());
    endDate = parsedEnd ?? new Date(startDate);
  }

  return { start: startDate, end: endDate };
}

type EventItem = Omit<EventWithStatus, "is_answered">;
type Snapshot = {
  events: EventItem[];
  answers: Map<string, Set<string> | null>;
};

let cached: { data: Snapshot; expires: number } | null = null;
let inflight: Promise<Snapshot> | null = null;

async function getDoc() {
  const { client_email, private_key } = getServiceAccountCredentials();
  const auth = new JWT({ email: client_email, key: private_key, scopes: SHEETS_SCOPE });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();
  return doc;
}

async function readAnsweredIds(sheet: GoogleSpreadsheetWorksheet): Promise<Set<string> | null> {
  const rows = await sheet.getRows();
  const header = resolveMemberIdHeader(sheet.headerValues ?? []);
  if (!header) return null;
  return new Set(rows.map((r) => normalizeMemberId(r.get(header))).filter(Boolean));
}

async function loadSnapshot(): Promise<Snapshot> {
  const doc = await getDoc();
  const eventRows = await doc.sheetsByTitle["Events"].getRows();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = eventRows
    .map((row, index) => {
      const rawDateStr = String(row.get("event_date") || "");
      const parsed = parseEventDateTime(rawDateStr);
      return {
        id: index,
        event_id: String(row.get("event_id") ?? "").trim(),
        title: (row.get("title") || "タイトル未設定") as string,
        event_date: formatEventDate(rawDateStr),
        form_url: (row.get("form_url") || "#") as string,
        _sheetName: resolveSheetName(row),
        _dateObj: parsed ? parsed.start : null,
      };
    })
    .filter((e): e is typeof e & { _dateObj: Date } => e._dateObj !== null && e._dateObj >= today)
    .sort((a, b) => a._dateObj.getTime() - b._dateObj.getTime());

  const answers = new Map<string, Set<string> | null>();
  await Promise.all(
    upcoming.map(async (e) => {
      const sheet = doc.sheetsByTitle[e._sheetName];
      if (!sheet) return;
      try {
        answers.set(e.event_id, await readAnsweredIds(sheet));
      } catch {
        answers.set(e.event_id, null);
      }
    })
  );

  return {
    events: upcoming.map(({ _dateObj, _sheetName, ...rest }) => rest),
    answers,
  };
}

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

function buildResult(snap: Snapshot, memberId?: string): EventWithStatus[] {
  const target = normalizeMemberId(memberId);
  return snap.events.map((e) => {
    let is_answered: boolean | null = false;
    if (target) {
      const ids = snap.answers.get(e.event_id);
      is_answered = ids == null ? null : ids.has(target);
    }
    return { ...e, is_answered };
  });
}

export async function getEventsData(memberId?: string): Promise<EventWithStatus[]> {
  try {
    return buildResult(await getSnapshot(), memberId);
  } catch (error) {
    if (cached) return buildResult(cached.data, memberId);
    throw error;
  }
}

export async function getEventSheetHealth(): Promise<EventSheetHealth[]> {
  const doc = await getDoc();
  const eventRows = await doc.sheetsByTitle["Events"].getRows();

  return Promise.all(
    eventRows
      .filter((row) => String(row.get("event_id") ?? "").trim())
      .map(async (row) => {
        const sheetName = resolveSheetName(row);
        const sheet = doc.sheetsByTitle[sheetName];
        const base = {
          event_id: String(row.get("event_id") ?? "").trim(),
          title: String(row.get("title") ?? ""),
          sheet_name: sheetName,
        };
        if (!sheet) {
          return { ...base, sheet_found: false, member_id_column: null, response_count: null };
        }
        try {
          const rows = await sheet.getRows();
          return {
            ...base,
            sheet_found: true,
            member_id_column: resolveMemberIdHeader(sheet.headerValues ?? []),
            response_count: rows.length,
          };
        } catch {
          return { ...base, sheet_found: true, member_id_column: null, response_count: null };
        }
      })
  );
}