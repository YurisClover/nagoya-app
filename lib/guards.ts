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
    const session = await requireUser();
    if(session.user?.role !== "admin") redirect ("/");
    return session;
}

// ---- API ルート用ガード ----
// ページ用の requireUser / requireAdmin は redirect() を投げるため、
// fetch で呼ばれる API ルートには不向き(fetch がログイン画面のHTMLを受け取ってしまう)。
// API 側では null チェックして JSON の 401 / 403 を返すこと。
export type ApiUser = { memberId: string; role: string };

export async function getApiUser(): Promise<ApiUser | null> {
    const session = await auth();
    const memberId = (session?.user?.id ?? "").trim();
    if (!session || !memberId) return null;
    return { memberId, role: session.user?.role ?? "" };
}