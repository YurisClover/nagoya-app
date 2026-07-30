import { NextRequest, NextResponse } from "next/server";
import {
  type GoogleFormStatus,
  setGoogleFormStatus,
} from "@/lib/google-forms";

const ALLOWED_STATUSES: GoogleFormStatus[] = [
  "private",
  "open",
  "closed",
];

export async function GET(request: NextRequest) {
  try {
    // テスト専用APIなので本番環境では使用不可
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          success: false,
          error: "このテストAPIは本番環境では使用できません。",
        },
        { status: 404 },
      );
    }

    const formId =
      request.nextUrl.searchParams.get("formId");

    const status =
      request.nextUrl.searchParams.get("status");

    if (!formId) {
      return NextResponse.json(
        {
          success: false,
          error: "formIdが指定されていません。",
        },
        { status: 400 },
      );
    }

    if (
      !status ||
      !ALLOWED_STATUSES.includes(
        status as GoogleFormStatus,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "statusにはprivate、open、closedのいずれかを指定してください。",
        },
        { status: 400 },
      );
    }

    const result = await setGoogleFormStatus(
      formId,
      status as GoogleFormStatus,
    );

    return NextResponse.json({
      success: true,
      message: getStatusMessage(
        status as GoogleFormStatus,
      ),
      formId,
      status,
      publishSettings:
        result.publishSettings ?? null,
    });
  } catch (error) {
    console.error(
      "Google Form status test error:",
      error,
    );

    const detail =
      error instanceof Error
        ? error.message
        : "不明なエラーが発生しました。";

    return NextResponse.json(
      {
        success: false,
        error:
          "Googleフォームの状態変更に失敗しました。",
        detail,
      },
      { status: 500 },
    );
  }
}

function getStatusMessage(
  status: GoogleFormStatus,
) {
  switch (status) {
    case "private":
      return "フォームを非公開にしました。";

    case "open":
      return "フォームを公開し、回答受付を開始しました。";

    case "closed":
      return "フォームの回答受付を終了しました。";
  }
}