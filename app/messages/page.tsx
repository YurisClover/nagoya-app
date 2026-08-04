import AppShell from '@/components/AppShell';
import MessagesClient from './MessagesClient';

export default async function MessagesPage() {
  return (
    <AppShell>
      <MessagesClient />
    </AppShell>
  );
}