import "server-only";
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
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

function getServiceAccountAuth() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("GOOGLE_CREDENTIALS_BASE64 is not set");
    const c = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    return new JWT({
        email: c.client_email,
        key: c.private_key.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
}

async function getUsersSheet() {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");
    const doc = new GoogleSpreadsheet(sheetId, getServiceAccountAuth());
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



export type MemberCounts = {
  totalMembers: number;  // 総会員数
  activeMembers: number; // 有効会員数 (status === "active")
};

/**
 * ダッシュボード用：総会員数と有効会員数をまとめて取得する
 */
export async function getMemberCounts(): Promise<MemberCounts> {
  const sheet = await getUsersSheet();
  const rows = await sheet.getRows();

  let total = 0;
  let active = 0;

  for (const row of rows) {
    const memberId = row.get("member_id");
    const deletedAt = row.get("deleted_at");

    // 会員IDが存在し、退会していないユーザーを対象とする
    if (memberId && !deletedAt) {
      total++;

      // status 列が "active" の場合を有効会員としてカウント
      const status = String(row.get("status") ?? "").trim().toLowerCase();
      if (status === "active") {
        active++;
      }
    }
  }

  return {
    totalMembers: total,
    activeMembers: active,
  };
}
