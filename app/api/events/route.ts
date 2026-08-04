import { auth } from "@/auth";
import { getEventsData } from "@/lib/events";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  // memberId (isAnswer?), role (draft / position)
  const data = await getEventsData({
    memberId: session.user?.id || undefined,
    role: session.user?.role || undefined
  });
  return NextResponse.json(data);
}