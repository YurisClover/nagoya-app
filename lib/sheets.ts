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

// export type DashboardMetrics = {
//   totalMembers: number;        // 総会員数
//   activeMembers: number;       // 有効会員数
//   monthlyEventsCount: number;  // 今月のイベント数
//   unreadMessagesCount: number; // 未読メッセージ数
// };

// /**
//  * ダッシュボード用の全指標をまとめて取得する
//  */
// export async function getDashboardMetrics(): Promise<DashboardMetrics> {
//   const sheetId = process.env.GOOGLE_SHEET_ID;
//   if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

//   // スプレッドシートへ接続して全シート情報を1回で読み込む
//   const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
//   await doc.loadInfo();

//   // -------------------------------------------------------------
//   // 1. 会員数のカウント (Users)
//   // -------------------------------------------------------------
//   let totalMembers = 0;
//   let activeMembers = 0;
//   const usersSheet = doc.sheetsByTitle["Users"];

//   if (usersSheet) {
//     const userRows = await usersSheet.getRows();
//     for (const row of userRows) {
//       const memberId = row.get("member_id");
//       const deletedAt = row.get("deleted_at");

//       if (memberId && !deletedAt) {
//         totalMembers++;
//         const status = String(row.get("status") ?? "").trim().toLowerCase();
//         if (status === "active") {
//           activeMembers++;
//         }
//       }
//     }
//   }

//   // -------------------------------------------------------------
//   // 2. 今月のイベント数のカウント (Events)
//   // -------------------------------------------------------------
//   let monthlyEventsCount = 0;
//   const eventsSheet = doc.sheetsByTitle["Events"];

//   if (eventsSheet) {
//     const eventRows = await eventsSheet.getRows();
//     const now = new Date();
//     const currentYear = now.getFullYear();
//     const currentMonth = now.getMonth(); // 0-indexed

//     for (const row of eventRows) {
//       const eventDateStr = row.get("event_date");
//       if (!eventDateStr) continue;

//       const eventDate = new Date(eventDateStr);
//       // 有効な日付かつ、現在の「年」と「月」が一致するかチェック
//       if (
//         !isNaN(eventDate.getTime()) &&
//         eventDate.getFullYear() === currentYear &&
//         eventDate.getMonth() === currentMonth
//       ) {
//         monthlyEventsCount++;
//       }
//     }
//   }

//   // -------------------------------------------------------------
//   // 3. 未読メッセージ数のカウント (Messages)
//   // -------------------------------------------------------------
//   let unreadMessagesCount = 0;
//   const messagesSheet = doc.sheetsByTitle["Messages"];

//   if (messagesSheet) {
//     const messageRows = await messagesSheet.getRows();
//     for (const row of messageRows) {
//       const isReadRaw = String(row.get("is_read") ?? "").trim().toLowerCase();
//       // is_read が "false" または "0" のものを未読としてカウント
//       if (isReadRaw === "false" || isReadRaw === "0") {
//         unreadMessagesCount++;
//       }
//     }
//   }

//   return {
//     totalMembers,
//     activeMembers,
//     monthlyEventsCount,
//     unreadMessagesCount,
//   };
// }



export type DashboardMetrics = {
  totalMembers: number;        // 総会員数
  newMembersThisMonth: number; // 今月追加された会員数 (+○今月)
  activeMembers: number;       // 有効会員数
  inactiveMembers: number;     // 無効会員数 (無効○名)
  monthlyEventsCount: number;  // 今月のイベント数
  eventRegistrationsCount: number; // 今月のイベントの出席登録件数
  unreadMessagesCount: number; // 未読メッセージ数
};

/**
 * ダッシュボード用の全指標をまとめて取得する
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

  const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
  await doc.loadInfo();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  
  // 会員数のカウント (Users)
  
  let totalMembers = 0;
  let activeMembers = 0;
  let inactiveMembers = 0;
  let newMembersThisMonth = 0;

  const usersSheet = doc.sheetsByTitle["Users"];

  if (usersSheet) {
    const userRows = await usersSheet.getRows();
    for (const row of userRows) {
      const memberId = row.get("member_id");
      const deletedAt = row.get("deleted_at");

      if (memberId && !deletedAt) {
        totalMembers++;

        // status の判定 (active / inactive)
        const status = String(row.get("status") ?? "").trim().toLowerCase();
        if (status === "active") {
          activeMembers++;
        } else if (status === "inactive") {
          inactiveMembers++;
        }

        // created_at 列から今月の新規追加人数をカウント
        const createdAtStr = row.get("created_at");
        if (createdAtStr) {
          const createdAt = new Date(createdAtStr);
          if (
            !isNaN(createdAt.getTime()) &&
            createdAt.getFullYear() === currentYear &&
            createdAt.getMonth() === currentMonth
          ) {
            newMembersThisMonth++;
          }
        }
      }
    }
  }

  
  // 今月のイベント数 & 各イベントシートからの出席登録数 (Events & 各イベントシート)
  
  let monthlyEventsCount = 0;
  let eventRegistrationsCount = 0;
  const eventsSheet = doc.sheetsByTitle["Events"];

  if (eventsSheet) {
    const eventRows = await eventsSheet.getRows();

    for (const row of eventRows) {
      const eventDateStr = row.get("event_date");
      const eventTitle = String(row.get("title") ?? "").trim();
      if (!eventDateStr) continue;

      const eventDate = new Date(eventDateStr);
      // 今月のイベントか判定
      if (
        !isNaN(eventDate.getTime()) &&
        eventDate.getFullYear() === currentYear &&
        eventDate.getMonth() === currentMonth
      ) {
        monthlyEventsCount++;

        // イベント名（例: "流しそうめん"）と同名のシートが存在するか確認
        if (eventTitle && doc.sheetsByTitle[eventTitle]) {
          try {
            const attendeeSheet = doc.sheetsByTitle[eventTitle];
            const attendeeRows = await attendeeSheet.getRows();
            // 出席登録シートのデータ行数を加算
            eventRegistrationsCount += attendeeRows.length;
          } catch (e) {
            console.error(`シート [${eventTitle}] の取得に失敗しました:`, e);
          }
        }
      }
    }
  }

  
  // 未読メッセージ数のカウント (Messages)
  
  let unreadMessagesCount = 0;
  const messagesSheet = doc.sheetsByTitle["Messages"];

  if (messagesSheet) {
    const messageRows = await messagesSheet.getRows();
    for (const row of messageRows) {
      const isReadRaw = String(row.get("is_read") ?? "").trim().toLowerCase();
      if (isReadRaw === "false" || isReadRaw === "0") {
        unreadMessagesCount++;
      }
    }
  }

  return {
    totalMembers,
    newMembersThisMonth,
    activeMembers,
    inactiveMembers,
    monthlyEventsCount,
    eventRegistrationsCount,
    unreadMessagesCount,
  };
}