// app/event-attendance/layout.tsx

import type { Metadata } from "next";
import "./globals.css"; // CSSはそのまま読み込む

export const metadata: Metadata = {
  title: "イベント案内一覧",
  description: "スマホ向けイベント出席案内アプリ",
};

export default function EventAttendanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 💡 フォント設定なし、html/bodyタグもなし。ただの div にします。
    <div className="attendance-wrapper flex flex-col min-h-screen w-full">
      {children}
    </div>
  );
}