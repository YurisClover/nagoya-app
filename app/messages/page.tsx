import AppShell from '@/components/AppShell';
import MessagesClient from './MessagesClient';
import { requireUser } from "@/lib/guards";

export default async function MessagesPage() {
  const user = await requireUser();
  
  // TypeScriptの型エラーを回避するため as any にキャスト
  const userObj = user as any;
  const currentUserId =
    userObj?.member_id ||
    userObj?.id ||
    userObj?.user?.member_id ||
    userObj?.user?.id ||
    '';

  return (
    <AppShell>
      <MessagesClient currentUserId={currentUserId} />
    </AppShell>
  );
}