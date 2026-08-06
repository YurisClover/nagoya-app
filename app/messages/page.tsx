import AppShell from '@/components/AppShell';
import MessagesClient from './MessagesClient';
import { requireUser } from "@/lib/guards";

await requireUser();

export default async function MessagesPage() {
  return (
    <AppShell>
      <MessagesClient />
    </AppShell>
  );
}