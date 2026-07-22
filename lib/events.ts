import "server-only";
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];
const PARTICIPANT_NAME_COLUMN = "参加者の名前をご記入ください。";

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

// normalize Japanese name: NFKC (全角↔半角) + delete space (山田 太郎 = 山田太郎)
function normalizeName(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

async function checkParticipation(sheet: GoogleSpreadsheetWorksheet, userName: string): Promise<boolean> {
  const rows = await sheet.getRows();
  const target = normalizeName(userName);
  return rows.some((row) => normalizeName(row.get(PARTICIPANT_NAME_COLUMN) || "") === target);
}

export async function getEventsData(userName?: string) {
  const { client_email, private_key } = getServiceAccountCredentials(); // 3A
  const auth = new JWT({ email: client_email, key: private_key, scopes: SHEETS_SCOPE });

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();

  const eventRows = await doc.sheetsByTitle["Events"].getRows();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // filter upcoming first
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

  return Promise.all(
    upcoming.map(async ({ _dateObj, ...e }) => {
      let is_answered: boolean | null = false;
      if (userName) {
        const participantSheet = doc.sheetsByTitle[e.title];
        if (participantSheet) {
          try {
            is_answered = await checkParticipation(participantSheet, userName);
          } catch {
            is_answered = null; // if can't read -> unknow != not_anwsered
          }
        }
      }
      return { ...e, is_answered };
    })
  );
}