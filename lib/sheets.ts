import "server-only";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

export type SheetUser = {
    member_id: string;
    user_name: string;
    password_hash: string;
    email: string;
    role: string;
    status: string;
};

function getServiceAccountAuth() {
    const raw = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!raw) {
        throw new Error("GOOGLE_CREDENTIALS_BASE64 is not set");
    }
    const credentials = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));

    return new JWT({
        email: credentials.client_email,
        key: credentials.private_key.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
}

export async function getUserByEmail(email: string): Promise<SheetUser | null> {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

    const doc = new GoogleSpreadsheet(sheetId, getServiceAccountAuth());
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["Users"];
    if (!sheet) throw new Error("'Users' sheet not found");

    const rows = await sheet.getRows();
    const target = email.trim().toLowerCase();
    const row = rows.find(
        (r) => String(r.get("email") ?? "").trim().toLowerCase() === target
    );
    if (!row) return null;
    if (row.get("deleted_at")) return null;

    return {
        member_id: String(row.get("member_id") ?? ""),
        user_name: String(row.get("user_name") ?? ""),
        password_hash: String(row.get("password_hash") ?? ""),
        email: String(row.get("email") ?? ""),
        role: String(row.get("role") ?? ""),
        status: String(row.get("status") ?? ""),
    };
}