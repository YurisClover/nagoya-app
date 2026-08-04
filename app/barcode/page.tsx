import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import MemberBarcode from "./MemberBarcode";

const BRANCH_NAME = "名古屋中支部";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-gray-600">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

export default async function BarcodePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // member_id + name from session (JWT) directly not from sheet
  // can show even sheet down
  const memberId = session.user.id ?? "";
  const userName = session.user.name ?? "—";

  return (
    <AppShell>
      <div className="page-container">
        <h1 className="mb-6 text-lg font-bold">会員証</h1>

        <dl className="space-y-4 text-sm">
          <InfoRow label="氏名" value={userName} />
          <InfoRow label="会員番号" value={memberId || "—"} />
          <InfoRow label="所属支部" value={BRANCH_NAME} />
        </dl>

        <div className="mt-10">
          {memberId ? (
            <MemberBarcode memberId={memberId} />
          ) : (
            <p className="text-center text-gray-500">会員番号が登録されていません</p>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-red-700">
          ※ バーコードは会員本人のみご使用ください。他者への貸与は禁止です。
        </p>
      </div>
    </AppShell>
  );
}