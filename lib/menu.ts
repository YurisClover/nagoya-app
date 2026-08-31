import {
  Home, IdCard, ChartPie, CalendarDays, Bot, ClipboardCheck, Mail, Building2, Settings,
  type LucideIcon,
} from "lucide-react";

export type MenuItem = {
  href: string;
  label: string;     // card name (home)
  navLabel: string;  // nav tab name (short)
  desc: string;
  Icon: LucideIcon;
  tone: string;      // color class from globals.css
  ready: boolean;    // false => 準備中 + no nav tab
  wide?: boolean;
  adminOnly?: boolean;
};

/** first nav tab */
export const HOME = { href: "/dashboard", navLabel: "ホーム", Icon: Home };

/** home and nav tab */
export const MENU: MenuItem[] = [
  { href: "/barcode",  label: "会員証",       navLabel: "会員証", desc: "バーコード表示", Icon: IdCard,         tone: "tone-blue",   ready: true },
  { href: "/training", label: "研修時間",     navLabel: "研修",   desc: "受講状況確認",   Icon: ChartPie,       tone: "tone-green",  ready: false },
  { href: "/schedule", label: "スケジュール", navLabel: "予定",   desc: "支部行事一覧",   Icon: CalendarDays,   tone: "tone-amber",  ready: true },
  { href: "/chat",     label: "税務相談",     navLabel: "相談",   desc: "AIチャット",     Icon: Bot,            tone: "tone-teal",   ready: false },
  { href: "/events",   label: "出席確認",     navLabel: "出席",   desc: "イベント参加",   Icon: ClipboardCheck, tone: "tone-purple", ready: true },
  { href: "/messages", label: "メッセージ",   navLabel: "連絡",   desc: "連絡・通知",     Icon: Mail,           tone: "tone-copper", ready: true },
  { href: "/site",     label: "中支部サイト・支部報", navLabel: "支部", desc: "公式サイトへ／支部報PDFを閲覧", Icon: Building2, tone: "tone-navy", ready: true, wide: true },
  { href: "/admin",    label: "管理者パネル", navLabel: "管理",   desc: "会員・イベント管理", Icon: Settings,   tone: "tone-gray",   ready: true, wide: true, adminOnly: true },
];