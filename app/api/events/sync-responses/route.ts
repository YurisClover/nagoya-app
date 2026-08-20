import { auth } from "@/auth";
import { syncEventResponseSheets } from "@/lib/event-response-sync";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "ログインが必要です。",
        },
        {
          status: 401,
        },
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        {
          error: "管理者権限が必要です。",
        },
        {
          status: 403,
        },
      );
    }

    const result = await syncEventResponseSheets();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Event response sync error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "回答同期に失敗しました。",
      },
      {
        status: 500,
      },
    );
  }
}
