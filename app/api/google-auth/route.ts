import { getApiUser } from "@/lib/guards";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createGoogleFormsOAuthClient } from "@/lib/google-auth";

const FORMS_SCOPES = [
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
];

export async function GET() {
  try {
    // One-time setup utility for obtaining GOOGLE_FORMS_REFRESH_TOKEN.
    // Kept admin-only in production so the OAuth surface stays closed;
    // local development remains open for convenience.
    if (process.env.NODE_ENV === "production") {
      const apiUser = await getApiUser();
      if (!apiUser || apiUser.role !== "admin") {
        return NextResponse.json({ success: false }, { status: 404 });
      }
    }

    const oauth2Client = createGoogleFormsOAuthClient();

    // 推測されにくい一時的なstateを生成
    const state = randomBytes(32).toString("hex");

    const authorizationUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: FORMS_SCOPES,
      state,
    });

    const response = NextResponse.redirect(authorizationUrl);

    // callbackで照合するためCookieへ一時保存
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Google OAuth initialization error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Google OAuthの初期化に失敗しました。",
      },
      { status: 500 },
    );
  }
}
