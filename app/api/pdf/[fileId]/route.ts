import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getPdfStream } from "@/lib/drive";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth();
  if (!session) return new Response("unauthorized", { status: 401 });

  const { fileId } = await params;
  if (!fileId) return new Response("ファイルIDが指定されていません", { status: 400 });

  try {
    const stream = await getPdfStream(fileId);
    return new Response(stream, { headers: { "Content-Type": "application/pdf" } });
  } catch (error) {
    console.error(error);
    return new Response("PDFの取得に失敗しました", { status: 500 });
  }
}