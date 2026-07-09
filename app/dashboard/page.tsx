import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth();
    if (!session) redirect("/login");

    return (
    <main style={{ maxWidth: 360, margin: "60px auto", padding: 24 }}>
        <h1 style={{ fontSize: 20 }}>ダッシュボード</h1>
        <p>ようこそ、{session.user?.name} さん</p>
        <p style={{ fontSize: 12, color: "#666" }}>{session.user?.email}</p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button type="submit" style={{ marginTop: 24, padding: "8px 16px" }}>ログアウト</button>
        </form>
    </main>
    );
}