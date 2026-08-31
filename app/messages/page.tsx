/**
 * Member messages page (/messages). Thin server wrapper: requireUser,
 * then hands the session member id to MessagesClient, which owns all
 * interaction. member_id comes from session.user.id (set by authorize()
 * in auth.ts).
 */
import AppShell from "@/components/AppShell";
import MessagesClient from "./MessagesClient";
import { requireUser } from "@/lib/guards";

export default async function MessagesPage() {
  const session = await requireUser();

  // auth.ts の authorize() が member_id を session.user.id に入れて返すため、
  // これがそのまま会員IDになる(as any のフォールバック連鎖は不要)。
  const currentUserId = session.user?.id ?? "";

  return (
    <AppShell>
      <MessagesClient currentUserId={currentUserId} />
    </AppShell>
  );
}
