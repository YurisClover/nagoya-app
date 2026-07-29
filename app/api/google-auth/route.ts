//OAuth2の使用、JSONを返すためのインポート
import { NextResponse } from "next/server";
import {createGoogleFormsOAuthClient} from "@/lib/google-auth";

//OAuthはGoogleフォーム作成・編集と回答取得が可能。
const FORMS_SCOPES = [
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/forms.responses.readonly",
];


export async function GET() {
    try{
      const oauth2Client = createGoogleFormsOAuthClient();

    //URLを作成し、googleの許可画面にうつる。
    const authorizationUrl = oauth2Client.generateAuthUrl({
        //リフレッシュトークンの発行
        access_type:"offline",
        //リフレッシュトークンを毎回発行する
        prompt:"consent",
        //scopeに入っている権限の取得の依頼
        scope:FORMS_SCOPES,
       } );

        //authorizationUrlへブラウザを移動させる。
       return NextResponse.redirect(authorizationUrl);
    }catch (error){
        console.error(error);

        return NextResponse.json(
            {
                error: "google OAuthの設定に失敗しました。",
            },
            {status:500},
        );
    }
    }