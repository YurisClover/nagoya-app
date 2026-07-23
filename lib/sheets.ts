import "server-only";
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
import { nowJST } from "./datetime";
import { unstable_cache } from "next/cache";

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

export type DashboardMetrics = {
  totalMembers: number;
  newMembersThisMonth: number;
  activeMembers: number;
  inactiveMembers: number;
  monthlyEventsCount: number;
  eventRegistrationsCount: number;
  unreadMessagesCount: number;
};

export type ActivityItem = {
  id: string;
  description: string;
  timestamp: string;
  type: string;
};

export type EventAttendanceItem = {
  eventId: string;
  title: string;
  eventDate: string;
  registrationCount: number;
  formUrl: string;
};

// 1. ダッシュボード指標の取得（1分間キャッシュ ＆ 既存の getSheetAuth を利用）
export const getDashboardMetrics = unstable_cache(
  async (): Promise<DashboardMetrics> => {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 1. ユーザー情報の集計 Promise
    const usersSheet = doc.sheetsByTitle["Users"];
    const usersPromise = usersSheet
      ? usersSheet.getRows().then((rows) => {
          let total = 0;
          let active = 0;
          let inactive = 0;
          let newThisMonth = 0;

          for (const row of rows) {
            const memberId = row.get("member_id");
            const deletedAt = row.get("deleted_at");

            if (memberId && !deletedAt) {
              total++;
              const status = String(row.get("status") ?? "").trim().toLowerCase();
              if (status === "active") active++;
              else if (status === "inactive") inactive++;

              const createdAtStr = row.get("created_at");
              if (createdAtStr) {
                const createdAt = new Date(createdAtStr);
                if (
                  !isNaN(createdAt.getTime()) &&
                  createdAt.getFullYear() === currentYear &&
                  createdAt.getMonth() === currentMonth
                ) {
                  newThisMonth++;
                }
              }
            }
          }
          return { total, active, inactive, newThisMonth };
        })
      : Promise.resolve({ total: 0, active: 0, inactive: 0, newThisMonth: 0 });

    // 2. 未読メッセージ数の集計 Promise
    const messagesSheet = doc.sheetsByTitle["Messages"];
    const messagesPromise = messagesSheet
      ? messagesSheet.getRows().then((rows) => {
          let unreadCount = 0;
          for (const row of rows) {
            const isReadRaw = String(row.get("is_read") ?? "").trim().toLowerCase();
            if (isReadRaw === "false" || isReadRaw === "0") {
              unreadCount++;
            }
          }
          return unreadCount;
        })
      : Promise.resolve(0);

    // 3. 今月のイベント数・参加者数の集計 Promise
    const eventsSheet = doc.sheetsByTitle["Events"];
    const eventsPromise = eventsSheet
      ? eventsSheet.getRows().then((eventRows) => {
          const currentMonthEvents = eventRows.filter((row) => {
            const eventDateStr = row.get("event_date");
            if (!eventDateStr) return false;
            const eventDate = new Date(eventDateStr);
            return (
              !isNaN(eventDate.getTime()) &&
              eventDate.getFullYear() === currentYear &&
              eventDate.getMonth() === currentMonth
            );
          });

          const monthlyEventsCount = currentMonthEvents.length;
          const eventRegistrationsCount = currentMonthEvents.reduce((sum, row) => {
            const count = parseInt(row.get("registration_count") || "0", 10);
            return sum + count;
          }, 0);

          return { monthlyEventsCount, eventRegistrationsCount };
        })
      : Promise.resolve({ monthlyEventsCount: 0, eventRegistrationsCount: 0 });

    // ★ 並列実行して各結果を受け取る
    const [usersData, unreadMessagesCount, eventsData] = await Promise.all([
      usersPromise,
      messagesPromise,
      eventsPromise,
    ]);

    // ★ まとめて返す
    return {
      totalMembers: usersData.total,
      newMembersThisMonth: usersData.newThisMonth,
      activeMembers: usersData.active,
      inactiveMembers: usersData.inactive,
      monthlyEventsCount: eventsData.monthlyEventsCount,
      eventRegistrationsCount: eventsData.eventRegistrationsCount,
      unreadMessagesCount,
    };
  },
  ["dashboard", "metrics", "v1"],
  { revalidate: 60, tags: ["dashboard-metrics"] }
);

// 2. 最近のアクティビティ取得（1分間キャッシュ）
export const getRecentActivities = unstable_cache(
  async (): Promise<ActivityItem[]> => {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["Activities"];
    if (!sheet) return [];

    const fetchedRows = await sheet.getRows();

    // 実際に値（created_at または action または description）が入っている行だけを抽出
    const validRows = fetchedRows.filter(
      (row) => row.get("created_at") || row.get("action") || row.get("description")
    );
    
    // 末尾5件を取り出して、新しい順（降順）に並べ替える
    const recentRows = validRows.slice(-5).reverse();

    const now = new Date();
    const todayStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

    return recentRows.map((row) => {
      const rawDateStr = row.get("created_at") || "";
      let formattedTime = "";

      if (rawDateStr) {
        const date = new Date(rawDateStr);
        if (!isNaN(date.getTime())) {
          const dateStr = date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
          const hours = date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", hour12: false });
          const minutes = date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", minute: "2-digit" });

          if (dateStr === todayStr) {
            formattedTime = `本日 ${hours}:${minutes}`;
          } else {
            const month = date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric" });
            const day = date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", day: "numeric" });
            formattedTime = `${month}月${day}日`;
        }
      }
    }

      return {
        id: String(row.get("activity_id") ?? Math.random().toString()),
        description: String(row.get("description") ?? ""),
        type: String(row.get("type") ?? "default"),
        timestamp: formattedTime || "直近",
      };
    });
  },
  ["recent-activities"],
  { revalidate: 60, tags: ["recent-activities"] }
);

// 3. イベント出席状況のリスト取得（1分間キャッシュ）
export const getEventAttendanceList = unstable_cache(
  async (): Promise<EventAttendanceItem[]> => {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();

    const eventsSheet = doc.sheetsByTitle["Events"];
    if (!eventsSheet) return [];

    const eventRows = await eventsSheet.getRows();

    // 各イベントのシートを開かずに、Events シートの registration_count をそのまま読む
    return eventRows.map((row) => {
      const eventId = String(row.get("event_id") ?? "");
      const title = String(row.get("title") ?? "").trim();
      const eventDate = String(row.get("event_date") ?? "");
      const formUrl = String(row.get("form_url") ?? "");
      
      // ★ ここが改善ポイント！個別のタブを開かず、列から直接取得
      const registrationCount = parseInt(row.get("registration_count") || "0", 10);

      return { eventId, title, eventDate, registrationCount, formUrl };
    });
  },
  ["event-attendance-list"],
  { revalidate: 60, tags: ["event-attendance-list"] }
);

// ログ記録（書き込み時は既存の nowJST をそのまま利用）
export async function logActivity(type: string, description: string): Promise<void> {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) return;

    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["Activities"];
    if (!sheet) return;

    await sheet.addRow({
      activity_id: `act_${Date.now()}`,
      type: type,
      description: description,
      created_at: nowJST(),
    });
  } catch (error) {
    console.error("アクティビティログの記録に失敗しました:", error);
  }
}