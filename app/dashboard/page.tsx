/*import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
    const session = await auth();
    if (!session) redirect("/login");
    return (
    <main style={{ maxWidth: 360, margin: "60px auto", padding: 24 }}>
        <h1 style={{ fontSize: 20 }}>ダッシュボード</h1>
        <p>ようこそ、{session.user?.name} さん</p>
        <p style={{ fontSize: 12, color: "#666" }}>{session.user?.email} ({session.user?.role})</p>
        { session.user?.role === "admin" && (
            <p style={{ marginTop: 12 }}><Link href="/admin">管理者パネル</Link></p>
        )}
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button type="submit" style={{ marginTop: 24, padding: "8px 16px" }}>ログアウト</button>
        </form>
    </main>
    );
}*/
// app/dashboard/page.tsx
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import NotificationInitializer from "@/components/NotificationInitializer"; // ★追加

export default async function DashboardPage() {
    const session = await auth();
    if (!session) redirect("/login");

    return (
    <main style={{ maxWidth: 360, margin: "60px auto", padding: 24 }}>
        {/* ★ここでログイン中のユーザーに紐づけて初期化を実行 */}
        <NotificationInitializer />

        <h1 style={{ fontSize: 20 }}>ダッシュボード</h1>
        <p>ようこそ、{session.user?.name} さん</p>
        <p style={{ fontSize: 12, color: "#666" }}>{session.user?.email} ({session.user?.role})</p>
        
        { session.user?.role === "admin" && (
            <p style={{ marginTop: 12 }}><Link href="/admin">管理者パネル</Link></p>
        )}
        
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button type="submit" style={{ marginTop: 24, padding: "8px 16px" }}>ログアウト</button>
        </form>
    </main>
    );
}