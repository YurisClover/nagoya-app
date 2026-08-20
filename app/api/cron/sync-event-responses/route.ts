import { timingSafeEqual } from "node:crypto";

import { syncEventResponseSheets } from "@/lib/event-response-sync";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return false;
  }

  const actual = request.headers.get("authorization") ?? "";

  const expected = `Bearer ${secret}`;

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: "認証に失敗しました。",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const result = await syncEventResponseSheets();

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    /*
     * 正常実行はActivitiesへ記録せず、
     * エラーだけログへ残す。
     */
    console.error("Automatic event response sync error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "自動回答同期に失敗しました。",
      },
      {
        status: 500,
      },
    );
  }
}
