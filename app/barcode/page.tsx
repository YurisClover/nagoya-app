import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserByEmail } from "@/lib/sheets";
import BarcodeUploader from "./BarcodeUploader";

export default async function BarcodePage() {
    const session = await auth();
    if (!session?.user?.email) redirect("/login");

    const user = await getUserByEmail(session.user.email);
    const raw = user?.barcode_data ?? "";
    const src = raw ? (raw.startsWith("data:") ? raw: `data:image/png;base64,${raw}`) : "";
    
    return (
        <main style={{ maxWidth: 360, margin: "40px auto", padding: 24, textAlign: "center"}}>
            <p style= {{ fontSize: 13 }}>{user?.user_name} 会員番号: {user?.member_id}</p>

            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="会員証バーコード"
                style={{ width: "100%", marginTop: 16, border: "1px solid #eee", padding: 8 }} />
            ) : (
                <p style={{ marginTop: 32, color: "#666" }}>バーコードが登録されていません</p>
            )}
            <BarcodeUploader />
            <p style={{ fontSize: 11, color: "#c0392b", marginTop: 24}}>
                ※ バーコードは会員本人のみご使用ください。他者への貸与は禁止です。
            </p>
        </main>
    );
}