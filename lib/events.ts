import "server-only";
import {
  GoogleSpreadsheet,
  GoogleSpreadsheetWorksheet,
} from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
import {
  EventWithStatus,
  EventSheetHealth,
  toEventPosition,
  toEventStatus,
  type EventPosition,
} from "@/types/event";
import { parseSheetDate } from "./datetime";

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

/** find 会員ID first then pattern */
function resolveMemberIdHeader(headers: string[]): string | null {
  for (const c of MEMBER_ID_HEADERS) if (headers.includes(c)) return c;
  return (
    headers.find(
      (h) => h.includes("会員") && (/ID/i.test(h) || h.includes("番号")),
    ) ?? null
  );
}

/** normalize member_id: if that column is number instead of plaintext */
function normalizeMemberId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/\.0+$/, "");
}

/** event_id → newest */
function eventIdNum(e: { event_id: string }): number {
  const n = Number(e.event_id);
  return Number.isFinite(n) ? n : -Infinity;
}

/** event sheet name: response_sheet first, if no fallback to title */
function resolveSheetName(row: { get: (k: string) => unknown }): string {
  const explicit = String(row.get("response_sheet") ?? "").trim();
  return explicit || String(row.get("title") ?? "").trim();
}

type EventItem = Omit<EventWithStatus, "is_answered">;
type Snapshot = {
  events: EventItem[];
  // key = event_id | Set = OK | null = can't find column or can't read | no key = no sheet
  answers: Map<string, Set<string> | null>;
};

let cached: { data: Snapshot; expires: number } | null = null;
let inflight: Promise<Snapshot> | null = null;

async function getDoc() {
  const { client_email, private_key } = getServiceAccountCredentials();
  const auth = new JWT({
    email: client_email,
    key: private_key,
    scopes: SHEETS_SCOPE,
  });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();
  return doc;
}

/** read ALL member_id from answer sheet */
async function readAnsweredIds(
  sheet: GoogleSpreadsheetWorksheet,
): Promise<Set<string> | null> {
  const rows = await sheet.getRows();
  const header = resolveMemberIdHeader(sheet.headerValues ?? []);
  if (!header) return null; // have sheet but no 会員ID column → unknown (!= "not anwser")
  return new Set(
    rows.map((r) => normalizeMemberId(r.get(header))).filter(Boolean),
  );
}

async function loadSnapshot(): Promise<Snapshot> {
  const doc = await getDoc();
  const eventRows = await doc.sheetsByTitle["Events"].getRows();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = eventRows
    .map((row, index) => ({
      id: index,
      event_id: String(row.get("event_id") ?? "").trim(),
      title: (row.get("title") || "タイトル未設定") as string,
      event_date: (row.get("event_date") || "") as string,
      form_url: (row.get("form_url") || "#") as string,
      location: (row.get("location") || "") as string,
      event_end_date: (row.get("event_end_date") || "") as string,
      status: toEventStatus(String(row.get("status") ?? "")),
      position: toEventPosition(String(row.get("position") ?? "")),
      prefill_url_template: String(
        row.get("prefill_url_template") ?? "",
      ).trim(),
      _deleted: String(row.get("is_deleted") ?? "")
        .trim()
        .toLowerCase(),
      _sheetName: resolveSheetName(row),
      _dateObj: parseSheetDate(row.get("event_date") || "", {
        yearHint: "future",
      }),
    }))
    .filter((e) => !["true", "1", "yes"].includes(e._deleted)) // soft delete (is_deleted)
    .filter(
      (e): e is typeof e & { _dateObj: Date } =>
        e._dateObj !== null && e._dateObj >= today,
    )
    .sort((a, b) => eventIdNum(b) - eventIdNum(a));

  // read all event sheet once → store as set (member_id) (all user)
  const answers = new Map<string, Set<string> | null>();
  await Promise.all(
    upcoming.map(async (e) => {
      const sheet = doc.sheetsByTitle[e._sheetName];
      if (!sheet) return; // no sheet → no key (seperate from "unreadable")
      try {
        answers.set(e.event_id, await readAnsweredIds(sheet));
      } catch {
        answers.set(e.event_id, null);
      }
    }),
  );

  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    events: upcoming.map(({ _dateObj, _sheetName, _deleted, ...rest }) => rest),
    answers,
  };
}

/** cache + single-flight */
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
/** admin: all event,
 * executive: published (general, executive),
 * general: published (general) */
export type EventViewer = { memberId?: string; role?: string };
function canSee(e: EventItem, role: string): boolean {
  const r = role.trim().toLowerCase() || "general";
  const status = e.status;
  const pos = e.position;
  if (r === "admin") return true;
  if (status !== "published" && status !== "closed") return false; // draft → admin only
  if (r === "executive") return pos === "general" || pos === "executive";
  return pos === "general";
}

/** build result user — compare member_id in memory (0 API call) */
function buildResult(
  snap: Snapshot,
  viewer?: EventViewer,
  position?: EventPosition,
): EventWithStatus[] {
  const target = normalizeMemberId(viewer?.memberId);
  const role = viewer?.role ?? "";
  return snap.events
    .filter((e) => canSee(e, role) && (!position || e.position === position))
    .map((e) => {
      let is_answered: boolean | null = false;
      if (target) {
        // undefined = no sheet, null = can't read
        const ids = snap.answers.get(e.event_id);
        is_answered = ids == null ? null : ids.has(target);
      }
      return { ...e, is_answered };
    });
}

export async function getEventsData(
  viewer?: EventViewer,
  position?: EventPosition,
): Promise<EventWithStatus[]> {
  try {
    return buildResult(await getSnapshot(), viewer, position);
  } catch (error) {
    if (cached) return buildResult(cached.data, viewer, position); // Sheet failed/429 → use past one
    throw error;
  }
}

/** check every event that bind with answer sheet (admin know first) */
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
          return {
            ...base,
            sheet_found: false,
            member_id_column: null,
            response_count: null,
          };
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
          return {
            ...base,
            sheet_found: true,
            member_id_column: null,
            response_count: null,
          };
        }
      }),
  );
}
