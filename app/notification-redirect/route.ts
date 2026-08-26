import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = String(session.user.role ?? "")
    .trim()
    .toLowerCase();

  if (role === "admin" || role === "executive") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.redirect(new URL("/dashboard", request.url));
}