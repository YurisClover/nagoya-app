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

//googleformの環境変数の取得
export function createGoogleFormsOAuthClient(){
    const clientId = process.env.GOOGLE_FORMS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_FORMS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_FORMS_REDIRECT_URI;

    if(!clientId || !clientSecret || !redirectUri){
        throw new Error("google Forms OAuthの環境変数が不足しています。");
    }

    //認証情報を取得しているOAuthクライアントの作成
    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri,
    );
}

