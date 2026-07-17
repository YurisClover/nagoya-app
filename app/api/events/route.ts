import { auth } from "@/auth";
import { getEventsData } from "@/lib/events";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await getEventsData();
  return NextResponse.json(data);
}