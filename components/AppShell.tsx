import { auth } from "@/auth";
import AppHeader from "./AppHeader";
import AppNav from "./AppNav";
import NotificationInitializer from "@/app/notification/NotificationInitializer";

/**
 * Frame for every member-side page: theme background + AppHeader +
 * AppNav tabs + content. Server component: reads the session once and
 * passes isAdmin down so the nav can show admin-only tabs.
 * Also mounts NotificationInitializer, which registers the FCM service
 * worker - this is why it must never throw (see lib/firebase.ts).
 */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    // theme-body = bg/font theme (move from body → no duplicate)
    <div className="theme-body min-h-screen">
      <NotificationInitializer />
      <div className="app-frame">
        <AppHeader />
        <AppNav isAdmin={isAdmin} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}