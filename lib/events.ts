import "server-only";
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
import type { EventPosition, EventSheetHealth, EventWithStatus } from "@/types/event";
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
  return headers.find((h) => h.includes("会員") && (/ID/i.test(h) || h.includes("番号"))) ?? null;
}

/** normalize member_id: if that column is number instead of plaintext */
function normalizeMemberId(v: unknown): string {
  return String(v ?? "").trim().replace(/\.0+$/, "");
}

function isVisibleEventStatus(value: unknown,): value is EventWithStatus["status"] {
  return ( value === "published" || value === "closed" );
}

function isEventPosition(value: unknown,): value is EventPosition {
  return ( value === "general" || value === "executive" );
}

function parseBoolean(value: unknown,): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return [ "true","1","yes",].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
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
  const auth = new JWT({ email: client_email, key: private_key, scopes: SHEETS_SCOPE });
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();
  return doc;
}

/** read ALL member_id from answer sheet */
async function readAnsweredIds(sheet: GoogleSpreadsheetWorksheet): Promise<Set<string> | null> {
  const rows = await sheet.getRows();
  const header = resolveMemberIdHeader(sheet.headerValues ?? []);
  if (!header) return null; // have sheet but no 会員ID column → unknown (!= "not anwser")
  return new Set(rows.map((r) => normalizeMemberId(r.get(header))).filter(Boolean));
}

async function loadSnapshot(): Promise<Snapshot> {
  const doc = await getDoc();
  const eventsSheet = doc.sheetsByTitle["Events"];

  if (!eventsSheet) {
    throw new Error("Eventsシートが見つかりません。",);
  }
  const eventRows =await eventsSheet.getRows();
  const now = new Date();
  const upcoming = eventRows.flatMap((row, index) => {
      const eventId = String(row.get("event_id") ?? "",).trim();

      const status = String(row.get("status") ?? "",).trim();

      const position = String(row.get("position") ?? "",).trim();

      const isDeleted = parseBoolean(row.get("is_deleted"),);

      const startDate = parseSheetDate(row.get("event_date") ??"", { yearHint: "future",},);

      const endDate = parseSheetDate(row.get("event_end_date",) ?? "",{ yearHint: "future",},);

      if (!eventId ||!isVisibleEventStatus(status,) ||!isEventPosition(position, ) ||
      isDeleted || !startDate || !endDate || endDate.getTime() <= now.getTime() ) {
        return [];
      }

      const numericId =
        Number(eventId);

      return [
        {
          id: Number.isFinite(
            numericId,
          )
            ? numericId
            : index,

          event_id: eventId,

          title: String(
            row.get("title") ??
              "タイトル未設定",
          ),

          event_date: String(
            row.get(
              "event_date",
            ) ?? "",
          ),

          event_end_date: String(
            row.get(
              "event_end_date",
            ) ?? "",
          ),

          form_url: String(
            row.get("form_url") ??
              "#",
          ),

          prefill_url_template:String(row.get("prefill_url_template",) ?? "",).trim(),

          location: String(
            row.get("location") ??
              "",
          ),

          position,
          status,

          _sheetName:
            resolveSheetName(row),

          _dateObj: startDate,
        },
      ];
    })
    .sort(
      (a, b) =>
        a._dateObj.getTime() -
        b._dateObj.getTime(),
    );

  /*
   * 現在は旧方式の回答済み判定を
   * 一時的に残している。
   *
   * answerシート1枚へ移行したら
   * この処理を置き換える。
   */
  const answers = new Map<
    string,
    Set<string> | null
  >();

  await Promise.all(
    upcoming.map(
      async (event) => {
        const sheet =
          doc.sheetsByTitle[
            event._sheetName
          ];

        if (!sheet) {
          return;
        }

        try {
          answers.set(
            event.event_id,
            await readAnsweredIds(
              sheet,
            ),
          );
        } catch {
          answers.set(
            event.event_id,
            null,
          );
        }
      },
    ),
  );

  return {
    events: upcoming.map(
      ({
        _dateObj,
        _sheetName,
        ...event
      }) => event,
    ),

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
// export type EventViewer = { memberId?: string; role?: string };
// function canSee(e: EventItem, role: string): boolean {
//   const r = role.trim().toLowerCase() || "general";
//   const status = e.status.trim().toLowerCase() || "published";
//   const pos = e.position.trim().toLowerCase() || "general";
//   if (r === "admin") return true;
//   if (status !== "published" && status !== "closed") return false; // draft → admin only
//   if (r === "executive") return pos === "general" || pos === "executive";
//   return pos === "general";
// }

// function buildResult(
//   snap: Snapshot,
//   memberId: string | undefined,
//   position: EventPosition,
// ): EventWithStatus[] {
//   const target =
//     normalizeMemberId(
//       memberId,
//     );

//   return snap.events
//     .filter(
//       (event) =>
//         event.position ===
//         position,
//     )
//     .map((event) => {
//       let is_answered:
//         | boolean
//         | null = false;

//       if (target) {
//         /*
//          * undefined:
//          * 回答シートが存在しない
//          *
//          * null:
//          * 回答シートを読み込めない
//          */
//         const ids =
//           snap.answers.get(
//             event.event_id,
//           );

//         is_answered =
//           ids == null
//             ? null
//             : ids.has(target);
//       }

//       return {
//         ...event,
//         is_answered,
//       };
//     });
// }

// export async function getEventsData(
//   memberId?: string,
//   position: EventPosition =
//     "general",
// ): Promise<EventWithStatus[]> {
//   try {
//     const snapshot =
//       await getSnapshot();

//     return buildResult(
//       snapshot,
//       memberId,
//       position,
//     );
//   } catch (error) {
//     if (cached) {
//       return buildResult(
//         cached.data,
//         memberId,
//         position,
//       );
//     }

//     throw error;
//   }
// }

/**
 * イベントを見るユーザーの情報。
 */
export type EventViewer = {
  memberId?: string;
  role?: string;
};

/**
 * roleによる最終的な閲覧権限判定。
 *
 * ユーザー向け画面では、
 * draftはroleに関係なく表示しない。
 */
function canSee(
  event: EventItem,
  role?: string,
): boolean {
  const normalizedRole =
    role?.trim().toLowerCase() ||
    "general";

  if (
    event.status !== "published" &&
    event.status !== "closed"
  ) {
    return false;
  }

  if (
    normalizedRole === "admin" ||
    normalizedRole === "executive"
  ) {
    return (
      event.position === "general" ||
      event.position === "executive"
    );
  }

  return event.position === "general";
}

function buildResult(
  snap: Snapshot,
  viewer: EventViewer | undefined,
  position: EventPosition,
): EventWithStatus[] {
  const target =
    normalizeMemberId(
      viewer?.memberId,
    );

  return snap.events
    /*
     * roleによる最終権限判定。
     *
     * generalユーザーがAPIのURLを
     * executiveに変更しても、
     * ここで除外される。
     */
    .filter((event) =>
      canSee(
        event,
        viewer?.role,
      ),
    )

    /*
     * 画面で選択されている
     * 一般向け／執行部向けで絞る。
     */
    .filter(
      (event) =>
        event.position ===
        position,
    )

    .map((event) => {
      let is_answered:
        | boolean
        | null = false;

      if (target) {
        /*
         * undefined:
         * 回答シートが存在しない
         *
         * null:
         * 回答シートを読み込めない
         */
        const ids =
          snap.answers.get(
            event.event_id,
          );

        is_answered =
          ids == null
            ? null
            : ids.has(target);
      }

      return {
        ...event,
        is_answered,
      };
    });
}

export async function getEventsData(
  viewer?: EventViewer,
  position: EventPosition =
    "general",
): Promise<EventWithStatus[]> {
  try {
    const snapshot =
      await getSnapshot();

    return buildResult(
      snapshot,
      viewer,
      position,
    );
  } catch (error) {
    if (cached) {
      return buildResult(
        cached.data,
        viewer,
        position,
      );
    }

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