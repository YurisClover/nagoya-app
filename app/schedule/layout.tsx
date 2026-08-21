import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "支部スケジュール",
  description: "支部行事のカレンダー",
};
export default function ScheduleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell> {children} </AppShell>;
}
