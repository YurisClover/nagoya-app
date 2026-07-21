import "server-only";
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
import { nowJST } from "./datetime";

export type SheetUser = {
  member_id: string;
  user_name: string;
  password_hash: string;
  email: string;
  role: string;
  status: string;
  barcode_data: string;
};

const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];

function getSheetAuth() {
    const {client_email, private_key} = getServiceAccountCredentials();
    return new JWT({ email: client_email, key: private_key, scopes: SHEETS_SCOPE});
}

async function getUsersSheet() {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");
    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Users"];
    if (!sheet) throw new Error("'Users' sheet not found");
    return sheet;
}

function findRowByEmail(rows: GoogleSpreadsheetRow[], email: string) {
    const target = email.trim().toLowerCase();
    return rows.find(
        (r) =>
        String(r.get("email") ?? "")
        .trim()
        .toLowerCase() === target,
    );
}

function rowToUser(row: GoogleSpreadsheetRow): SheetUser {
    return {
        member_id: String(row.get("member_id") ?? ""),
        user_name: String(row.get("user_name") ?? ""),
        password_hash: String(row.get("password_hash") ?? ""),
        email: String(row.get("email") ?? ""),
        role: String(row.get("role") ?? ""),
        status: String(row.get("status") ?? ""),
        barcode_data: String(row.get("barcode_data") ?? ""),
    };
}

export async function getUserByEmail(email: string): Promise<SheetUser | null> {
    const sheet = await getUsersSheet();
    const row = findRowByEmail(await sheet.getRows(), email);
    if (!row || row.get("deleted_at")) return null;
    return rowToUser(row);
}

export async function updateUserBarcode(
    email: string,
    barcodeData: string,
): Promise<void> {
    const sheet = await getUsersSheet();
    const row = findRowByEmail(await sheet.getRows(), email);
    if (!row || row.get("deleted_at")) throw new Error("User not found");
    row.set("barcode_data", barcodeData);
    row.set("updated_at", nowJST()); // toISOString() return UTF (JP is UTF + 9) <- create new function
    await row.save();
}



// export type MemberCounts = {
//   totalMembers: number;  // 総会員数
//   activeMembers: number; // 有効会員数 (status === "active")
// };

// /**
//  * ダッシュボード用：総会員数と有効会員数をまとめて取得する
//  */
// export async function getMemberCounts(): Promise<MemberCounts> {
//   const sheet = await getUsersSheet();
//   const rows = await sheet.getRows();

//   let total = 0;
//   let active = 0;

//   for (const row of rows) {
//     const memberId = row.get("member_id");
//     const deletedAt = row.get("deleted_at");

//     // 会員IDが存在し、退会していないユーザーを対象とする
//     if (memberId && !deletedAt) {
//       total++;

//       // status 列が "active" の場合を有効会員としてカウント
//       const status = String(row.get("status") ?? "").trim().toLowerCase();
//       if (status === "active") {
//         active++;
//       }
//     }
//   }

//   return {
//     totalMembers: total,
//     activeMembers: active,
//   };
// }
// 📄 lib/sheets.ts の一番下に追加

export type DashboardMetrics = {
  totalMembers: number;        // 総会員数
  activeMembers: number;       // 有効会員数
  monthlyEventsCount: number;  // 今月のイベント数
  unreadMessagesCount: number; // 未読メッセージ数
};

/**
 * ダッシュボード用の全指標をまとめて取得する
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

  // スプレッドシートへ接続して全シート情報を1回で読み込む
  const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
  await doc.loadInfo();

  // -------------------------------------------------------------
  // 1. 会員数のカウント (Users)
  // -------------------------------------------------------------
  let totalMembers = 0;
  let activeMembers = 0;
  const usersSheet = doc.sheetsByTitle["Users"];

  if (usersSheet) {
    const userRows = await usersSheet.getRows();
    for (const row of userRows) {
      const memberId = row.get("member_id");
      const deletedAt = row.get("deleted_at");

      if (memberId && !deletedAt) {
        totalMembers++;
        const status = String(row.get("status") ?? "").trim().toLowerCase();
        if (status === "active") {
          activeMembers++;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. 今月のイベント数のカウント (Events)
  // -------------------------------------------------------------
  let monthlyEventsCount = 0;
  const eventsSheet = doc.sheetsByTitle["Events"];

  if (eventsSheet) {
    const eventRows = await eventsSheet.getRows();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    for (const row of eventRows) {
      const eventDateStr = row.get("event_date");
      if (!eventDateStr) continue;

      const eventDate = new Date(eventDateStr);
      // 有効な日付かつ、現在の「年」と「月」が一致するかチェック
      if (
        !isNaN(eventDate.getTime()) &&
        eventDate.getFullYear() === currentYear &&
        eventDate.getMonth() === currentMonth
      ) {
        monthlyEventsCount++;
      }
    }
  }

  // -------------------------------------------------------------
  // 3. 未読メッセージ数のカウント (Messages)
  // -------------------------------------------------------------
  let unreadMessagesCount = 0;
  const messagesSheet = doc.sheetsByTitle["Messages"];

  if (messagesSheet) {
    const messageRows = await messagesSheet.getRows();
    for (const row of messageRows) {
      const isReadRaw = String(row.get("is_read") ?? "").trim().toLowerCase();
      // is_read が "false" または "0" のものを未読としてカウント
      if (isReadRaw === "false" || isReadRaw === "0") {
        unreadMessagesCount++;
      }
    }
  }

  return {
    totalMembers,
    activeMembers,
    monthlyEventsCount,
    unreadMessagesCount,
  };
}