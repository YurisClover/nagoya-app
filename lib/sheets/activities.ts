/**
 * Activities domain: the audit trail on the Activities sheet.
 * logActivity swallows its own errors - logging must never fail the
 * operation being logged.
 */
import "server-only";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { revalidateTag, unstable_cache } from "next/cache";
import { randomUUID } from "node:crypto";
import { nowJST, parseSheetDate } from "@/lib/datetime";
import { getSheetAuth } from "./core";

export type ActivityType =
  | "member"
  | "attendance"
  | "message"
  | "group";
export type ActivityItem = {
  id: string;
  description: string;
  timestamp: string;
  type: string;
};
const ACTIVITY_TIME_ZONE = "Asia/Tokyo";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function formatActivityTimestamp( date: Date, now: Date = new Date(),): string {
  const dateOptions = { timeZone: ACTIVITY_TIME_ZONE, } as const;
  const dateStr = date.toLocaleDateString("sv-SE", dateOptions);
  const todayStr = now.toLocaleDateString("sv-SE", dateOptions);
  const yesterdayStr = new Date(now.getTime() - ONE_DAY_MS).toLocaleDateString( "sv-SE", dateOptions, );

  const time = new Intl.DateTimeFormat("ja-JP", {
    timeZone: ACTIVITY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

  if (dateStr === todayStr) {
    return `本日 ${time}`;
  }

  if (dateStr === yesterdayStr) {
    return `昨日 ${time}`;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const currentYear = Number(todayStr.slice(0, 4));
  if (year === currentYear) {
    return `${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
}

export const getRecentActivities = unstable_cache( async (): Promise<ActivityItem[]> => {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) {
      throw new Error("GOOGLE_SHEETS_ID is not set");
    }
    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Activities"];
    if (!sheet) {
      return [];
    }
    const fetchedRows = await sheet.getRows();
    const recentActivities = fetchedRows
      .flatMap((row, index) => {
        const description = String(row.get("description") ?? "").trim();
        const type = String(row.get("type") ?? "").trim();
        const rawCreatedAt = String(row.get("created_at") ?? "").trim();
        const createdAt = parseSheetDate(rawCreatedAt, {
          yearHint: "past",
        });

        if (!description || !type || !createdAt) {
          return [];
        }

        const activityId = String(row.get("activity_id") ?? "").trim() ||`activity-row-${index}`;
        return [
          {
            id: activityId,
            description,
            type,
            createdAt,
          },
        ];
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) .slice(0, 5);

    return recentActivities.map(({ createdAt, ...activity }) => ({
      ...activity,
      timestamp: formatActivityTimestamp(createdAt),
    }));
  },
  ["recent-activities"],
  {
    revalidate: 300,
    tags: ["recent-activities"],
  },
);

// 3. イベント出席状況のリスト取得（1分間キャッシュ）
export async function logActivity( type: ActivityType, description: string,): Promise<void> {
  try {
    const normalizedDescription = description.trim();
    if (!normalizedDescription) {
      return;
    }
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) {
      console.error("GOOGLE_SHEETS_ID is not set");
      return;
    }
    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Activities"];
    if (!sheet) {
      console.error("'Activities' sheet not found");
      return;
    }
    await sheet.addRow(
      {
        activity_id: randomUUID(),
        type,
        description: normalizedDescription,
        created_at: nowJST(),
      },
        { raw: true, },
    );
    revalidateTag("recent-activities", {
      expire: 0,
    });
  } catch (error) {
    console.error("アクティビティの記録に失敗しました:", error);
  }
}

//adminのユーザー管理画面の処理
// ----------------------------------------------------
// 会員管理（一覧・検索・ページネーション用）
// ----------------------------------------------------

// 1. 一覧表示用に型を拡張（created_at, deleted_at を含む）
