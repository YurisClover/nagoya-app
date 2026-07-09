import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
const CREDIT = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64").toString("utf8")
);
const SPREADSHEET_KEY = process.env.GOOGLE_SHEET_ID;

const getSpreadsheetTitleByKey = async (spreasheetKey) => {
    // 1. JWT認証の設定を修正
    const serviceAccountAuth = new JWT({
        email: CREDIT.client_email,
        // \n を実際の改行コードに変換する処理を追加しておくと安全です
        key: CREDIT.private_key.replace(/\\n/g, '\n'), 
        // スコープをGoogleスプレッドシート専用のものに修正
        scopes: ['https://www.googleapis.com/auth/spreadsheets'], 
    });

    const doc = new GoogleSpreadsheet(spreasheetKey, serviceAccountAuth);
    
    await doc.loadInfo(); 
    console.log("🎉 接続成功！シート名:", doc.title);
}

getSpreadsheetTitleByKey(SPREADSHEET_KEY).catch(err => {
    console.error("❌ 実行エラー:", err.message);
});