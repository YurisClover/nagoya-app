import {
  syncEventResponseSheets,
} from "@/lib/event-response-sync";

import {
  NextResponse,
} from "next/server";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


export async function POST(
  request: Request,
) {
  try {
    const expectedSecret =
      process.env
        .EVENT_RESPONSE_SYNC_SECRET
        ?.trim();

    if (!expectedSecret) {
      console.error(
        "EVENT_RESPONSE_SYNC_SECRETが設定されていません。",
      );

      return NextResponse.json(
        {
          error:
            "同期APIの設定に問題があります。",
        },
        {
          status: 500,
        },
      );
    }


    const authorization =
      request.headers
        .get(
          "authorization",
        )
        ?.trim() ?? "";


    const prefix =
      "Bearer ";


    const providedSecret =
      authorization.startsWith(
        prefix,
      )
        ? authorization
            .slice(
              prefix.length,
            )
            .trim()
        : "";


    if (
      !providedSecret ||
      providedSecret !==
        expectedSecret
    ) {
      return NextResponse.json(
        {
          error:
            "認証に失敗しました。",
        },
        {
          status: 401,
        },
      );
    }


    const result =
      await syncEventResponseSheets();


    return NextResponse.json(
      result,
    );
  } catch (error) {
    console.error(
      "Automatic event response sync error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "回答同期に失敗しました。",
      },
      {
        status: 500,
      },
    );
  }
}