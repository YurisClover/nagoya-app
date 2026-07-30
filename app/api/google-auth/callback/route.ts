import { NextRequest, NextResponse } from "next/server";
import { createGoogleFormsOAuthClient } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const oauthError = searchParams.get("error");

    // 認可開始時にCookieへ保存したstate
    const savedState = request.cookies.get("google_oauth_state")?.value;

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

    if (!returnedState || !savedState || returnedState !== savedState) {
      return NextResponse.json(
        {
          success: false,
          error: "Google OAuthのstate確認に失敗しました。",
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

    if (process.env.NODE_ENV === "development") {
      console.log("========================================");
      console.log("Google Forms OAuth認可成功");
      console.log("Refresh Token:");
      console.log(tokens.refresh_token);
      console.log("========================================");
    }

    const response = NextResponse.json({
      success: true,
      message:
        "Googleの認可に成功しました。VS Codeのターミナルを確認してください。",
    });

    // 使用済みstateを削除
    response.cookies.delete("google_oauth_state");

    return response;
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