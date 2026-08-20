import "server-only";
import {
  GoogleSpreadsheet,
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

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "";
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

async function loadSnapshot(): Promise<Snapshot> {
  const doc = await getDoc();
  const eventRows = await doc.sheetsByTitle["Events"].getRows();

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
    }))
    .filter((e) => !["true", "1", "yes"].includes(e._deleted)) // soft delete (is_deleted)
    .sort((a, b) => eventIdNum(b) - eventIdNum(a));

  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    events: upcoming.map(({ _deleted, ...rest }) => rest),
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
executive: published (general, executive),
general: published (general) */
export type EventViewer = { role?: string };
function canSee(e: EventItem, role: string): boolean {
  const r = role.trim().toLowerCase() || "general";
  const status = e.status;
  const pos = e.position;
  if (r === "admin") return true;
  if (status !== "published" && status !== "closed") return false; // draft → admin only
  if (r === "executive") return pos === "general" || pos === "executive";
  return pos === "general";
}

/** filter from role/position — is_answered by /api/events from Answers sheet */
function buildResult(
  snap: Snapshot,
  viewer?: EventViewer,
  position?: EventPosition,
): EventWithStatus[] {
  const role = viewer?.role ?? "";
  const isAdmin = role.trim().toLowerCase() === "admin";
  // JST
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 3600_000);
  const today = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) -
      9 * 3600_000,
  );
  // if not end show (until end)
  const stillRelevant = (e: EventItem) => {
    const end =
      parseSheetDate(e.event_end_date, { yearHint: "future" }) ??
      parseSheetDate(e.event_date, { yearHint: "future" });
    return end !== null && end >= today;
  };
  return snap.events
    .filter(
      (e) =>
        canSee(e, role) &&
        (isAdmin || stillRelevant(e)) && // admin still see ended event
        (!position || e.position === position),
    )
    .map((e) => ({ ...e, is_answered: null as boolean | null }));
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