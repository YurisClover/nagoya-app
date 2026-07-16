import  { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
    const session = await auth();
    if (!session) redirect("/login");
    if (session.user?.role !== "admin") redirect ("/dashboard"); // recheck at server (defense in dept)
    return (
        <main style={{ maxWidth: 360, margin: "60px auto", padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 24 }}>管理者パネル</h1>
            <p>ようこそ、{session.user?.name} さん (role : {session.user?.role})</p>
        </main>
    );
}