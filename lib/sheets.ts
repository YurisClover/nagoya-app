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
    };
}

export async function getUserByEmail(email: string): Promise<SheetUser | null> {
    const sheet = await getUsersSheet();
    const row = findRowByEmail(await sheet.getRows(), email);
    if (!row || row.get("deleted_at")) return null;
    return rowToUser(row);
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
export type Member = Omit<SheetUser, "password_hash"> & {
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
      role: String(row.get("role") ?? "general"),
      status: String(row.get("status") ?? "active"),
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

// ====================================================
// グループ管理関連の最適化版コード
// ====================================================

export type Group = {
  group_id: string;
  group_name: string;
  created_by: string;
  created_at: string;
};

export type GroupWithMembers = Group & {
  members: SheetUser[];
};

// 共通ドキュメント取得関数（doc.loadInfo() を1回だけ行う）
async function getGoogleDoc() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");
  const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
  await doc.loadInfo();
  return doc;
}

// 1. 全グループ＆所属メンバーの取得関数
export async function getGroupsWithMembers(): Promise<GroupWithMembers[]> {
  const doc = await getGoogleDoc();
  const groupsSheet = doc.sheetsByTitle["Groups"];
  const groupMembersSheet = doc.sheetsByTitle["GroupMembers"];
  const usersSheet = doc.sheetsByTitle["Users"];

  if (!groupsSheet || !groupMembersSheet || !usersSheet) {
    throw new Error("必要なシートが見つかりません");
  }

  // 3つのシートの行データを並列取得
  const [groupRows, memberRows, userRows] = await Promise.all([
    groupsSheet.getRows(),
    groupMembersSheet.getRows(),
    usersSheet.getRows(),
  ]);

  const userMap = new Map<string, SheetUser>();
  userRows.forEach((row) => {
    if (!row.get("deleted_at")) {
      userMap.set(String(row.get("member_id")), rowToUser(row));
    }
  });

  const groupMembersMap = new Map<string, string[]>();
  memberRows.forEach((row) => {
    const gId = String(row.get("group_id"));
    const mId = String(row.get("member_id"));
    if (!groupMembersMap.has(gId)) {
      groupMembersMap.set(gId, []);
    }
    groupMembersMap.get(gId)!.push(mId);
  });

  return groupRows.map((row) => {
    const group_id = String(row.get("group_id"));
    const memberIds = groupMembersMap.get(group_id) || [];
    const members = memberIds
      .map((id) => userMap.get(id))
      .filter((u): u is SheetUser => u !== undefined);

    return {
      group_id,
      group_name: String(row.get("group_name") ?? ""),
      created_by: String(row.get("created_by") ?? ""),
      created_at: String(row.get("created_at") ?? ""),
      members,
    };
  });
}

// キャッシュ版の関数（画面表示はこちらを使う）
export const getCachedGroupsWithMembers = unstable_cache(
  async () => getGroupsWithMembers(),
  ["groups-with-members-list"],
  {
    tags: ["groups"],
    revalidate: 60,
  }
);

// 2. 単一グループの取得
export async function getGroupById(group_id: string): Promise<GroupWithMembers | null> {
  const all = await getCachedGroupsWithMembers();
  return all.find((g) => g.group_id === group_id) || null;
}

// 3. 新規グループ追加（一括追加で高速化）
export async function addGroupToSheet(data: {
  group_name: string;
  member_ids: string[];
  created_by: string;
  created_at: string;
}) {
  try {
    const doc = await getGoogleDoc();
    const groupsSheet = doc.sheetsByTitle["Groups"];
    const groupMembersSheet = doc.sheetsByTitle["GroupMembers"];

    const rows = await groupsSheet.getRows();
    const nextId = `G${String(rows.length + 1).padStart(4, "0")}`;

    await groupsSheet.addRow({
      group_id: nextId,
      group_name: data.group_name,
      created_by: data.created_by,
      created_at: data.created_at,
    });

    // ★ addRows で一括追加（爆速化）
    if (data.member_ids.length > 0) {
      const newMemberRows = data.member_ids.map((member_id) => ({
        group_id: nextId,
        member_id,
        created_at: data.created_at,
      }));
      await groupMembersSheet.addRows(newMemberRows);
    }

    revalidateTag("groups", "default");
    return { success: true, group_id: nextId };
  } catch (error) {
    console.error("Failed to add group:", error);
    return { success: false, error: "グループの追加に失敗しました。" };
  }
}

// 4. グループ更新（一括削除＆一括追加で高速化）
export async function updateGroupInSheet(
  group_id: string,
  data: { group_name: string; member_ids: string[]; updated_at: string }
) {
  try {
    const doc = await getGoogleDoc();
    const groupsSheet = doc.sheetsByTitle["Groups"];
    const groupMembersSheet = doc.sheetsByTitle["GroupMembers"];

    const groupRows = await groupsSheet.getRows();
    const targetGroup = groupRows.find((r) => String(r.get("group_id")) === group_id);
    if (targetGroup) {
      targetGroup.set("group_name", data.group_name);
      await targetGroup.save();
    }

    // 旧メンバーの削除
    const memberRows = await groupMembersSheet.getRows();
    const oldRows = memberRows.filter((r) => String(r.get("group_id")) === group_id);
    for (const row of oldRows) {
      await row.delete();
    }

    // ★ addRows で新メンバーを一括追加
    if (data.member_ids.length > 0) {
      const newMemberRows = data.member_ids.map((member_id) => ({
        group_id,
        member_id,
        created_at: data.updated_at,
      }));
      await groupMembersSheet.addRows(newMemberRows);
    }

    revalidateTag("groups", "default");
    return { success: true };
  } catch (error) {
    console.error("Failed to update group:", error);
    return { success: false, error: "グループの更新に失敗しました。" };
  }
}

// 5. グループ物理削除
export async function deleteGroupFromSheet(group_id: string) {
  try {
    const doc = await getGoogleDoc();
    const groupsSheet = doc.sheetsByTitle["Groups"];
    const groupMembersSheet = doc.sheetsByTitle["GroupMembers"];

    const groupRows = await groupsSheet.getRows();
    const targetGroup = groupRows.find((r) => String(r.get("group_id")) === group_id);
    if (targetGroup) await targetGroup.delete();

    const memberRows = await groupMembersSheet.getRows();
    const targetMembers = memberRows.filter((r) => String(r.get("group_id")) === group_id);
    for (const row of targetMembers) {
      await row.delete();
    }

    revalidateTag("groups", "default");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete group:", error);
    return { success: false, error: "グループの削除に失敗しました。" };
  }
}

