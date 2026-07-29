import {google} from "googleapis";
import {NextRequest, NextResponse} from "next/server";
import {createGoogleFormsOAuthClient} from "@/lib/google-auth";

export async function GET (request:NextRequest){
    try{
        //Googleから返されたURLのクエリパラメータを取得
        const searchParams = request.nextUrl.searchParams;

        //認可に成功した場合に返される一時的な認可コード
        const code = searchParams.get("code");

        //ユーザーが拒否した場合などに返されるエラー
        const oauthError = searchParams.get("error");
    
        if (oauthError) {
      return NextResponse.json(
        {
          success: false,
          error: "Googleの認可が許可されませんでした。",
          detail: oauthError,
        },
        { status: 400 },
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "Googleから認可コードを取得できませんでした。",
        },
        { status: 400 },
      );
    }

    const oauth2Client = createGoogleFormsOAuthClient();
    // const clientId = process.env.GOOGLE_FORMS_CLIENT_ID;
    // const clientSecret = process.env.GOOGLE_FORMS_CLIENT_SECRET;
    // const redirectUri = process.env.GOOGLE_FORMS_REDIRECT_URI;

    // if (!clientId || !clientSecret || !redirectUri) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: "Google OAuthの環境変数が設定されていません。",
    //     },
    //     { status: 500 },
    //   );
    // }

    // // 認可開始時と同じ情報でOAuthクライアントを作成
    // const oauth2Client = new google.auth.OAuth2(
    //   clientId,
    //   clientSecret,
    //   redirectUri,
    // );

    // 認可コードをアクセストークン・リフレッシュトークンに交換
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error: "リフレッシュトークンを取得できませんでした。",
          message:
            "Googleアカウントの接続を解除してから、もう一度認可してください。",
        },
        { status: 400 },
      );
    }

    /*
     * 今回はローカル開発でリフレッシュトークンを1回取得するため、
     * 開発環境でのみターミナルに表示する。
     *
     * 本番環境ではログへ出力しない。
     */
    if (process.env.NODE_ENV === "development") {
      console.log("========================================");
      console.log("Google Forms OAuth認可成功");
      console.log("Refresh Token:");
      console.log(tokens.refresh_token);
      console.log("========================================");
    }

    return NextResponse.json({
      success: true,
      message:
        "Googleの認可に成功しました。VS Codeのターミナルを確認してください。",
    });
  } catch (error) {
    console.error("Google OAuth callback error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Google OAuthのトークン交換に失敗しました。",
      },
      { status: 500 },
    );
  }
}