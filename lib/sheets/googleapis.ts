import "server-only";
import { google, type sheets_v4 } from "googleapis";
import { getServiceAccountCredentials } from "@/lib/google-auth";

const SCOPE_RW = ["https://www.googleapis.com/auth/spreadsheets"];
const SCOPE_RO = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

/**
 * Messages 系のルートが使う googleapis の sheets クライアントを生成する。
 *
 * 認証情報はチーム共通の GOOGLE_SERVICE_ACCOUNT_KEY(base64) を
 * lib/google-auth 経由で取得する。以前のように FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY を各ルートで直接読むのをやめ、認証の入口を1か所に集約する。
 *
 * @param readonly true の場合は読み取り専用スコープ
 * @returns { sheets, spreadsheetId }
 */
export function getSheetsClient(readonly = false): {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
} {
  const { client_email, private_key } = getServiceAccountCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: readonly ? SCOPE_RO : SCOPE_RW,
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");

  return { sheets, spreadsheetId };
}
