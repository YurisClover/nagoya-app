import { signOut } from "@/auth";
import { LogOut } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="flex items-center justify-between bg-[#1a3a5c] px-[14px] py-[11px] text-white">
      <div>
        <p className="text-[14px] font-medium leading-tight">名古屋中支部</p>
        <p className="mt-[1px] text-[10px] opacity-80">名古屋税理士会</p>
      </div>

      <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] opacity-90 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <LogOut size={16} aria-hidden="true" />
          ログアウト
        </button>
      </form>
    </header>
  );
}