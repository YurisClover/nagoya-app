import "server-only";
import {google} from "googleapis";

export type ServiceAccountCredentials = {
    client_email: string;
    private_key: string;
};

// decode service account from env
// return credential : each lib create auth client library
export function getServiceAccountCredentials(): ServiceAccountCredentials {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if(!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
    const c = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
    return {
        client_email: c.client_email,
        private_key: String(c.private_key).replace(/\\n/g, "\n"),
    };
}

/**
 * 認可URLの生成や、認可コードの交換に使用するOAuthクライアント
 */
export function createGoogleFormsOAuthClient() {
  const clientId = process.env.GOOGLE_FORMS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_FORMS_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_FORMS_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Forms OAuthの環境変数が設定されていません。",
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );
}

/**
 * Google Forms APIの実行に使用する認証済みOAuthクライアント
 */
export function createAuthenticatedGoogleFormsOAuthClient() {
  const refreshToken =
    process.env.GOOGLE_FORMS_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error(
      "GOOGLE_FORMS_REFRESH_TOKENが設定されていません。",
    );
  }

  const oauth2Client =
    createGoogleFormsOAuthClient();

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}