/**
 * Dead FCM token hygiene.
 *
 * Logout cleanup (lib/logout.ts) covers devices that log out properly.
 * This covers the other half: tokens that died silently - app uninstalled,
 * browser data cleared, permission revoked. Firebase reports those per
 * token on each send; we collect them and blank the matching cells in the
 * Users sheet so future sends stop targeting them.
 *
 * Everything here is fail-soft: cleanup problems only log a warning and
 * never affect the send that triggered them.
 */
import "server-only";

import { getSheetsClient } from "@/lib/sheets/googleapis";

// Structural subset of firebase-admin's SendResponse, so callers can pass
// response.responses without this module importing firebase-admin types.
type SendOutcome = { success: boolean; error?: { code?: string } | null };

// Codes that mean the token is permanently invalid (not a transient error).
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/** Pair each send outcome with its token and keep the permanently dead ones. */
export function collectDeadTokens(
  tokens: string[],
  outcomes: SendOutcome[],
): string[] {
  const dead: string[] = [];
  outcomes.forEach((outcome, i) => {
    const code = String(outcome.error?.code ?? "");
    if (!outcome.success && DEAD_TOKEN_CODES.has(code) && tokens[i]) {
      dead.push(tokens[i]);
    }
  });
  return dead;
}

/** Blank the fcm_token cell of every row holding one of the dead tokens. */
export async function removeDeadFcmTokens(deadTokens: string[]): Promise<void> {
  if (deadTokens.length === 0) return;
  try {
    const { sheets, spreadsheetId } = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Users!A1:Z",
    });
    const rows = (res.data.values as string[][]) ?? [];
    if (rows.length < 2) return;

    const headers = rows[0].map((h) => String(h).toLowerCase().trim());
    const tokenIdx = headers.findIndex((h) => h === "fcm_token");
    if (tokenIdx === -1) return;

    const dead = new Set(deadTokens.map((t) => t.trim()));
    // Users fits comfortably within A-Z, matching the read range above.
    const col = String.fromCharCode(65 + tokenIdx);

    const data = rows
      .map((row, i) => ({
        token: String(row[tokenIdx] ?? "").trim(),
        rowNumber: i + 1,
      }))
      .filter((r) => r.rowNumber > 1 && r.token && dead.has(r.token))
      .map((r) => ({ range: `Users!${col}${r.rowNumber}`, values: [[""]] }));
    if (data.length === 0) return;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
    console.log(`Cleared ${data.length} dead FCM token(s) from the Users sheet`);
  } catch (error) {
    console.warn("Failed to clear dead FCM tokens:", error);
  }
}
