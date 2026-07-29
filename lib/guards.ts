import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

export async function requireUser(): Promise<Session> {
    const session = await auth();
    if(!session) redirect("/login");
    return session;
}

export async function requireAdmin() {
    const session = await auth();
    if(!session) redirect("/login");
    if(session.user?.role !== "admin") redirect ("/");
    return session;
}