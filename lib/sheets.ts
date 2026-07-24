import "server-only";
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
import { nowJST, parseSheetDate, jstYearMonth } from "./datetime";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";

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

// 1. ダッシュボード指標の取得（1分間キャッシュ,既存の getSheetAuth を利用）
export const getDashboardMetrics = unstable_cache(
  async (): Promise<DashboardMetrics> => {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();

    const currentMonthKey = jstYearMonth(new Date()); // "YYYY-MM" ตามเวลาญี่ปุ่น

    // 1. ユーザー情報の集計
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
                const createdAt = parseSheetDate(createdAtStr, { yearHint: "past" });
                if (createdAt && jstYearMonth(createdAt) === currentMonthKey) {
                  newThisMonth++;
                }
              }
            }
          }
          return { total, active, inactive, newThisMonth };
        })
      : Promise.resolve({ total: 0, active: 0, inactive: 0, newThisMonth: 0 });

    // 2. 未読メッセージ数の集計 
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

    // 3. 今月のイベント数・参加者数の集計 
    const eventsSheet = doc.sheetsByTitle["Events"];
    const eventsPromise = eventsSheet
      ? eventsSheet.getRows().then((eventRows) => {
          const currentMonthEvents = eventRows.filter((row) => {
            const eventDateStr = row.get("event_date");
            if (!eventDateStr) return false;
            const eventDate = parseSheetDate(eventDateStr, { yearHint: "current" });
            return eventDate !== null && jstYearMonth(eventDate) === currentMonthKey;
          });

          const monthlyEventsCount = currentMonthEvents.length;
          const eventRegistrationsCount = currentMonthEvents.reduce((sum, row) => {
            const count = parseInt(row.get("registration_count") || "0", 10);
            return sum + count;
          }, 0);

          return { monthlyEventsCount, eventRegistrationsCount };
        })
      : Promise.resolve({ monthlyEventsCount: 0, eventRegistrationsCount: 0 });

    // 並列実行して各結果を受け取る
    const [usersData, unreadMessagesCount, eventsData] = await Promise.all([
      usersPromise,
      messagesPromise,
      eventsPromise,
    ]);

    // まとめて返す
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
        const date = parseSheetDate(rawDateStr, { yearHint: "past" });
        if (date) {
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
      
      // 列から取得
      const registrationCount = parseInt(row.get("registration_count") || "0", 10);

      return { eventId, title, eventDate, registrationCount, formUrl };
    });
  },
  ["event-attendance-list"],
  { revalidate: 60, tags: ["event-attendance-list"] }
);

// ログ記録
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

//adminのユーザー管理画面の処理
// ----------------------------------------------------
// 会員管理（一覧・検索・ページネーション用）
// ----------------------------------------------------

// 1. 一覧表示用に型を拡張（created_at, deleted_at を含む）
export type Member = SheetUser & {
  created_at?: string;
  deleted_at?: string | null;
};

// 2. 【全会員データを取得する内部関数】
// 既存の getUsersSheet() を活用してシートを取得
async function fetchAllMembersFromSheet(): Promise<Member[]> {
  try {
    const sheet = await getUsersSheet(); 
    const rows = await sheet.getRows();

    return rows.map((row) => ({
      member_id: String(row.get("member_id") ?? ""),
      user_name: String(row.get("user_name") ?? ""),
      password_hash: String(row.get("password_hash") ?? ""),
      email: String(row.get("email") ?? ""),
      role: String(row.get("role") ?? "一般会員"),
      status: String(row.get("status") ?? "有効"),
      barcode_data: String(row.get("barcode_data") ?? ""),
      created_at: String(row.get("created_at") ?? ""),
      deleted_at: row.get("deleted_at") ? String(row.get("deleted_at")) : null,
    }));
  } catch (error) {
    console.error("Failed to fetch members from sheet:", error);
    return [];
  }
}

// 3. 【キャッシュ付き会員一覧取得】
// 60秒間はGoogle APIを叩かずキャッシュを返す
export const getCachedMembers = unstable_cache(
  async () => {
    return await fetchAllMembersFromSheet();
  },
  ["members-list-cache"],
  {
    revalidate: 60,
    tags: ["members"], // 新規登録や更新時に revalidateTag("members") で即時キャッシュ破棄が可能
  }
);

// 4. 【サーバー側での検索・絞り込み・ページネーション処理】
export async function getPaginatedMembers(params: {
  query: string;
  role: string;
  status: string;
  page: number;
  limit: number;
}) {
  const allMembers = await getCachedMembers();

  // 物理削除 (deleted_at に値が入っているもの) を自動除外
  const activeMembers = allMembers.filter((m) => !m.deleted_at);

  // 検索窓・フィルター絞り込み
  const filtered = activeMembers.filter((m) => {
    const q = params.query.toLowerCase();
    const matchesSearch =
      !params.query ||
      m.user_name.toLowerCase().includes(q) ||
      m.member_id.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q);

    const matchesRole = params.role === "all" || m.role === params.role;
    const matchesStatus = params.status === "all" || m.status === params.status;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // 10件分切り出しとページネーション計算
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / params.limit) || 1;
  const startIndex = (params.page - 1) * params.limit;
  const endIndex = Math.min(startIndex + params.limit, totalItems);
  const items = filtered.slice(startIndex, endIndex);

  return {
    items,
    totalItems,
    totalPages,
    startIndex: totalItems > 0 ? startIndex + 1 : 0,
    endIndex,
  };
}

// ----------------------------------------------------
// 新規会員の追加処理
// ----------------------------------------------------
export async function addMemberToSheet(newMember: {
  member_id: string;
  user_name: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  created_at: string;
}) {
  try {
    const sheet = await getUsersSheet();

    // スプレッドシートの末尾に1行追加
    await sheet.addRow({
      member_id: newMember.member_id,
      user_name: newMember.user_name,
      password_hash: newMember.password_hash, // ハッシュ化された文字列を書き込む
      email: newMember.email,
      role: newMember.role,
      status: newMember.status,
      barcode_data: "",
      created_at: newMember.created_at,
      deleted_at: "",
    });

    // キャッシュを破棄して即時反映
    revalidateTag("members", "default");

    return { success: true };
  } catch (error) {
    console.error("Failed to add member to sheet:", error);
    return { success: false, error: "スプレッドシートの更新に失敗しました。" };
  }
}