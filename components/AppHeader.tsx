"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { deleteToken } from "firebase/messaging";
import { messaging } from "@/lib/firebase";

const handleLogout = async () => {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("fcm_token") : null;
    // UsersシートのFCMトークンを削除
    const response = await fetch("/api/remove-fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      console.warn("UsersシートのFCMトークン削除に失敗しました");
    }

    // Firebase側の現在のブラウザトークンを無効化
    if (typeof window !== "undefined" && messaging) {
      try {
        await deleteToken(messaging);
        console.log("Firebase FCMトークンを削除しました");
      } catch (error) {
        console.warn( "Firebase FCMトークンの削除に失敗しました:", error );
      }
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("fcm_token");
      localStorage.removeItem("fcm_token_sent");
    }
  } catch (error) {
    console.error("ログアウトクリーンアップ中のエラー:", error);
  } finally {
    await signOut({ callbackUrl: "/login" });
  }
};

export default function AppHeader() {
  return (
    <header className="app-header">
      <div>
        <p className="text-sm font-medium leading-tight">名古屋中支部</p>
        <p className="text-[10px] opacity-80">名古屋税理士会</p>
      </div>

      <button
        //onClick={() => signOut({ callbackUrl: "/login" })}
        onClick={handleLogout}
        className="btn btn-ghost px-2 py-1 text-[11px]"
      >
        <LogOut size={16} aria-hidden="true" />
        ログアウト
      </button>
    </header>
  );
}
