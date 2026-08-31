/**
 * Shared Google Sheets access for the lib/sheets domain modules:
 * service-account auth and the two document loaders. Internal to
 * lib/sheets/* - app code imports domains via the lib/sheets barrel.
 */
import "server-only";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccountCredentials } from "@/lib/google-auth";
const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];

export function getSheetAuth() {
    const {client_email, private_key} = getServiceAccountCredentials();
    return new JWT({ email: client_email, key: private_key, scopes: SHEETS_SCOPE});
}

export async function getUsersSheet() {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEETS_ID is not set");
    const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Users"];
    if (!sheet) throw new Error("'Users' sheet not found");
    return sheet;
}

export async function getGoogleDoc() {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEETS_ID is not set");
  const doc = new GoogleSpreadsheet(sheetId, getSheetAuth());
  await doc.loadInfo();
  return doc;
}

// 1. 全グループ＆所属メンバーの取得関数
