import ".././globals.css"; // CSSはそのまま読み込む
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "イベント案内一覧",
  description: "スマホ向けイベント出席案内アプリ",
};

export default function EventsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}