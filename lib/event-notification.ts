import "server-only";

import { getFirebaseAdminMessaging } from "@/lib/firebase-admin";
import { getSheetsClient } from "@/lib/sheets/googleapis";
import { collectDeadTokens, removeDeadFcmTokens } from "@/lib/fcm-cleanup";

type EventNotificationTarget = {
  title: string;
  position: "general" | "executive";
};

export async function sendEventPublishedNotification(
    event: EventNotificationTarget,): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient(true);
  const usersRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Users!A1:Z", });
  const rows = (usersRes.data.values || []) as string[][];
  if (rows.length <= 1) {
    return;
  }
  const headers = rows[0].map((header) => String(header).toLowerCase().trim(), );
  const roleIdx = headers.findIndex((header) => header === "role");
  const statusIdx = headers.findIndex((header) => header === "status");
  const fcmTokenIdx = headers.findIndex( (header) => header === "fcm_token", );

  if (fcmTokenIdx === -1) {
    console.warn( "イベント通知: Usersシートに fcm_token 列が見つかりません",);
    return;
  }

  const tokens = rows .slice(1) .filter((row) => {
      const status = statusIdx !== -1  ? String(row[statusIdx] ?? "").trim().toLowerCase() : "";
      const isActive = status === "active" || status === "有効";
      if (!isActive) {
        return false;
      }

      // 一般向けイベントは全active会員へ通知
      if (event.position === "general") {
        return true;
      }

      // 執行部向けイベントは executive / admin のみ
      const role = roleIdx !== -1 ? String(row[roleIdx] ?? "").trim().toLowerCase() : "";
      return role === "executive" || role === "admin";
    })
    .map((row) => String(row[fcmTokenIdx] ?? "").trim())
    .filter(Boolean);

  const uniqueTokens = Array.from(new Set(tokens));
  if (uniqueTokens.length === 0) {
    console.log("イベント通知: 送信対象のFCMトークンがありません");
    return;
  }

  const messaging = getFirebaseAdminMessaging();
  const deadTokens: string[] = [];
  // Firebase Admin SDKは1回最大500トークン
  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const tokenChunk = uniqueTokens.slice(i, i + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: tokenChunk,
      data: { title: "イベントが公開されました",
              body: event.title,
              url: '/notification-redirect', },
    });

    if (response.failureCount > 0) {
      console.warn(
        `イベントFCM通知: ${response.successCount}件成功 / ${response.failureCount}件失敗`,
      );
    }
    deadTokens.push(...collectDeadTokens(tokenChunk, response.responses));
  }

  // Permanently-invalid tokens get cleared so future sends skip them.
  await removeDeadFcmTokens(deadTokens);
}