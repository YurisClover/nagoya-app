import "server-only";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
import type { EventWithStatus } from "@/types/event";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];
const PARTICIPANT_MEMBER_ID_COLUMN = "会員番号を記入してください。";
const TTL_MS = 60_000;

type EventItem = Omit<EventWithStatus, "is_answered">;
type Snapshot = {
  events: EventItem[];
  // title → Set member_id that answered | null = can't read sheet | no key = no sheet
  answers: Map<string, Set<string> | null>;
};

let cached: { data: Snapshot; expires: number } | null = null;
let inflight: Promise<Snapshot> | null = null;

function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? parseInt(timeMatch[1], 10) : 0;
  const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;
  const withYear = dateStr.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
  if (withYear) return new Date(+withYear[1], +withYear[2] - 1, +withYear[3], hour, minute);
  const md = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
  if (!md) return null;
  const month = +md[1] - 1, day = +md[2];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let d = new Date(now.getFullYear(), month, day, hour, minute);
  if (d < today) d = new Date(now.getFullYear() + 1, month, day, hour, minute);
  return d;
}

/** read Sheet — call once per TTL then share to all user */
async function loadSnapshot(): Promise<Snapshot> {
  const { client_email, private_key } = getServiceAccountCredentials();
  const auth = new JWT({ email: client_email, key: private_key, scopes: SHEETS_SCOPE });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);

  await doc.loadInfo(); // read 1
  const eventRows = await doc.sheetsByTitle["Events"].getRows(); // read 2

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  // read all event sheet once → store as set (member_id) (all user)
  const answers = new Map<string, Set<string> | null>();
  await Promise.all(
    upcoming.map(async (e) => {
      const sheet = doc.sheetsByTitle[e.title];
      if (!sheet) return; // no sheet → no one answer
      try {
        const rows = await sheet.getRows(); // read 3..N
        const ids = new Set(
          rows.map((r) => String(r.get(PARTICIPANT_MEMBER_ID_COLUMN) || "").trim()).filter(Boolean)
        );
        answers.set(e.title, ids);
      } catch {
        answers.set(e.title, null); // can't read → unknown status
      }
    })
  );

  return { events: upcoming.map(({ _dateObj, ...rest }) => rest), answers };
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

/** build result user — compare member_id in memory (0 API call) */
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

export async function getEventsData(memberId?: string): Promise<EventWithStatus[]> {
  try {
    return buildResult(await getSnapshot(), memberId);
  } catch (error) {
    if (cached) return buildResult(cached.data, memberId); // Sheet failed/429 → use past one
    throw error;
  }
}