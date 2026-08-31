/**
 * Admin dashboard reads: aggregated metrics and the current month's
 * event attendance list (sorted by event date, soonest first).
 */
import "server-only";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { unstable_cache } from "next/cache";
import { parseSheetDate, jstYearMonth } from "@/lib/datetime";
import { getSheetAuth } from "./core";

export type DashboardMetrics = {
  totalMembers: number;
  newMembersThisMonth: number;
  activeMembers: number;
  inactiveMembers: number;
  monthlyEventsCount: number;
  eventRegistrationsCount: number;
  unreadMessagesCount: number;
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
  async (currentMemberId: string = "admin"): Promise<DashboardMetrics> => {
    const targetMemberId = currentMemberId || "admin";
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEETS_ID is not set");

    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();

    const currentMonthKey = jstYearMonth(new Date()); // "YYYY-MM"

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
            // 各フィールドの値を取得
            const recipientId = String(row.get("recipient_id") ?? "").trim();
            const isReadRaw = String(row.get("is_read") ?? "").trim().toLowerCase();
            const deleteFlagRaw = String(row.get("delete_flag") ?? "").trim().toLowerCase();

            // 未読 (is_read が false, "false", "0" など)
            const isRead = isReadRaw === "true" || isReadRaw === "1" || isReadRaw === "既読";
            const isUnread = !isRead;

            // 未削除 (delete_flag が false, "false", "0", または空)
            const isDeleted = deleteFlagRaw === "true" || deleteFlagRaw === "1";
            const isNotDeleted = !isDeleted;

            // 宛先が admin のものに絞る（必要に応じてユーザーID等に変更してください）
            const isValidRecipient = recipientId === "admin" || recipientId === targetMemberId;

            // すべての条件を満たした場合のみカウントアップ
            if (isUnread && isNotDeleted && isValidRecipient) {
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
  { revalidate: 60, tags: ["dashboard-metrics", "members"] }
);

// 2. 最近のアクティビティ取得（5分間キャッシュ）
export const getEventAttendanceList = unstable_cache(
  async (): Promise<EventAttendanceItem[]> => {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEETS_ID is not set");

    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();

    const eventsSheet = doc.sheetsByTitle["Events"];
    if (!eventsSheet) return [];

    const eventRows = await eventsSheet.getRows();

    // 今月（JST）に開始するイベントのみ — 終了が来月でもOK（開始日だけ見る）
    const thisMonth = jstYearMonth(new Date());
    return eventRows
      .filter(
        (row) =>
          !["true", "1", "yes"].includes(
            String(row.get("is_deleted") ?? "").trim().toLowerCase(),
          ),
      )
      .map((row) => {
      const eventId = String(row.get("event_id") ?? "");
      const title = String(row.get("title") ?? "").trim();
      const eventDate = String(row.get("event_date") ?? "");
      const formUrl = String(row.get("form_url") ?? "");

      // 列から取得
      const registrationCount = parseInt(row.get("registration_count") || "0", 10);

      return { eventId, title, eventDate, registrationCount, formUrl };
    })
    .filter((item) => {
        const d = parseSheetDate(item.eventDate, { yearHint: "current" });
        return d !== null && jstYearMonth(d) === thisMonth;
    })
    // Sort here (server side) by event date, soonest first. event_id is a
    // UUID now, so id-based ordering is meaningless; components must not
    // re-sort by id.
    .sort((a, b) => {
        const ta = parseSheetDate(a.eventDate, { yearHint: "current" })?.getTime() ?? Number.POSITIVE_INFINITY;
        const tb = parseSheetDate(b.eventDate, { yearHint: "current" })?.getTime() ?? Number.POSITIVE_INFINITY;
        return ta - tb;
    });
  },
  ["event-attendance-list"],
  { revalidate: 60, tags: ["event-attendance-list"] }
);

// アクティビティ記録
