import { auth } from "@/auth";
import AppHeader from "./AppHeader";
import AppNav from "./AppNav";

/** user frame = theme bg + header + nav tab + content */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    // theme-body = bg/font theme (move from body → no duplicate)
    <div className="theme-body min-h-screen">
      <div className="app-frame">
        <AppHeader />
        <AppNav isAdmin={isAdmin} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}