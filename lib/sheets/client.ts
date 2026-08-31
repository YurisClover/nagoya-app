import "server-only";

import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

import {
  getServiceAccountCredentials,
} from "@/lib/google-auth";

const SHEETS_SCOPE = [
  "https://www.googleapis.com/auth/spreadsheets",
];

function createSheetAuth() {
  const {
    client_email,
    private_key,
  } = getServiceAccountCredentials();

  return new JWT({
    email: client_email,
    key: private_key,
    scopes: SHEETS_SCOPE,
  });
}

/**
 * Googleスプレッドシートへ接続する
 */
export async function getSpreadsheet() {
  const sheetId =
    process.env.GOOGLE_SHEETS_ID;

  if (!sheetId) {
    throw new Error(
      "GOOGLE_SHEETS_ID is not set",
    );
  }

  const document =
    new GoogleSpreadsheet(
      sheetId,
      createSheetAuth(),
    );

  await document.loadInfo();

  return document;
}