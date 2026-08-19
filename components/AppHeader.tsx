"use client"; // ★ クライアント側で実行するために追加

import { signOut } from "next-auth/react"; // ★ クライアント用の signOut に変更
import { LogOut } from "lucide-react";
import { deleteToken } from "firebase/messaging";
import { messaging } from "@/lib/firebase";

export default function AppHeader() {
  const handleLogout = async () => {
    try {
      // 1. Firebaseから現在のブラウザのトークンを完全に削除（無効化）
      if (typeof window !== "undefined" && messaging) {
        try {
          await deleteToken(messaging);
          console.log("Firebase FCMトークンを削除しました");
        } catch (e) {
          console.warn("FCMトークンの削除に失敗しました（スキップします）:", e);
        }
      }

      // 2. データベース（スプレッドシート）のトークンを消去
      await fetch("/api/remove-fcm-token", {
        method: "POST",
      });

      // 3. ローカルストレージのクリア
      if (typeof window !== "undefined") {
        localStorage.removeItem("fcm_token_sent");
        localStorage.removeItem("fcm_token");
      }
    } catch (error) {
      console.error("ログアウトクリーンアップ中のエラー:", error);
    } finally {
      // 4. 確実に NextAuth でログアウトさせ、ログイン画面へリダイレクト
      await signOut({ callbackUrl: "/login" });
    }
  };

  return (
    <header className="app-header">
      <div>
        <p className="text-sm font-medium leading-tight">名古屋中支部</p>
        <p className="text-[10px] opacity-80">名古屋税理士会</p>
      </div>

      {/* formと"use server"を外し、buttonのonClickで関数を呼び出します */}
      <button 
        onClick={handleLogout} 
        className="btn btn-ghost px-2 py-1 text-[11px]"
      >
        <LogOut size={16} aria-hidden="true" />
        ログアウト
      </button>
    </header>
  );
}