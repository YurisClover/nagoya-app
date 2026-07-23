import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import {
  IdCard, ChartPie, CalendarDays, Bot, ClipboardCheck, Mail, Building2, Settings,
  type LucideIcon,
} from "lucide-react";

type MenuItem = {
  href: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
  tone: string;
  ready: boolean;
  wide?: boolean;
  adminOnly?: boolean;
};

const MENU: MenuItem[] = [
  { href: "/barcode",  label: "会員証",       desc: "バーコード表示", Icon: IdCard,         tone: "bg-[#e6f1fb] text-[#185fa5]", ready: true },
  { href: "/training", label: "研修時間",     desc: "受講状況確認",   Icon: ChartPie,       tone: "bg-[#eaf3de] text-[#3b6d11]", ready: false },
  { href: "/schedule", label: "スケジュール", desc: "支部行事一覧",   Icon: CalendarDays,   tone: "bg-[#faeeda] text-[#854f0b]", ready: false },
  { href: "/chat",     label: "税務相談",     desc: "AIチャット",     Icon: Bot,            tone: "bg-[#e1f5ee] text-[#0f6e56]", ready: false },
  { href: "/events",   label: "出席確認",     desc: "イベント参加",   Icon: ClipboardCheck, tone: "bg-[#eeedfe] text-[#534ab7]", ready: true },
  { href: "/messages", label: "メッセージ",   desc: "連絡・通知",     Icon: Mail,           tone: "bg-[#faece7] text-[#993c1d]", ready: false },
  { href: "/site",     label: "中支部サイト・支部報", desc: "公式サイトへ／支部報PDFを閲覧", Icon: Building2, tone: "bg-[#d6e8f7] text-[#1a3a5c]", ready: true,  wide: true },
  { href: "/admin",    label: "管理者パネル", desc: "会員・イベント管理", Icon: Settings,   tone: "bg-[#e8e8ea] text-[#44444a]", ready: false, wide: true, adminOnly: true },
];

function MenuCard({ item }: { item: MenuItem }) {
  const { Icon } = item;
  const span = item.wide ? "col-span-2" : "";

  const inner = (
    <>
      <div className={`mb-[7px] flex h-[34px] w-[34px] items-center justify-center rounded-lg ${item.tone}`}>
        <Icon size={17} aria-hidden="true" />
      </div>
      <p className="text-[12px] font-medium text-neutral-900">{item.label}</p>
      <p className="mt-[2px] text-[10px] text-neutral-500">{item.desc}</p>
    </>
  );

  if (!item.ready) {
    return (
      <div aria-disabled="true" className={`relative rounded-xl border border-neutral-200 bg-neutral-50 p-3 opacity-60 ${span}`}>
        <span className="absolute right-[7px] top-[7px] rounded-full bg-neutral-200 px-[6px] py-[1px] text-[9px] font-medium text-neutral-600">
          準備中
        </span>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`relative rounded-xl border border-neutral-200 bg-white p-3 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1a3a5c] ${span}`}
    >
      {inner}
    </Link>
  );
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "admin";
  const items = MENU.filter((m) => !m.adminOnly || isAdmin);

  return (
    <div className="mx-auto min-h-screen max-w-[390px] bg-white">
      <AppHeader />

      <main className="p-[13px]">
        <section className="mb-[14px] rounded-xl bg-[#1a3a5c] p-[14px] text-white">
          <p className="text-[15px] font-medium">{session.user.name} 様</p>
          <p className="mt-[3px] text-[11px] opacity-80">名古屋中支部 会員</p>
          <span className="mt-[7px] inline-block rounded-full bg-white/20 px-[10px] py-[3px] text-[11px]">
            会員番号：{session.user.id}
          </span>
        </section>

        <h2 className="mb-2 text-[12px] font-medium text-neutral-900">メニュー</h2>
        <div className="grid grid-cols-2 gap-[9px]">
          {items.map((item) => <MenuCard key={item.href} item={item} />)}
        </div>
      </main>
    </div>
  );
}