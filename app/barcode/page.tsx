/**
 * Member card page (/barcode). Shows name, member id and the barcode.
 *
 * Identity comes from the JWT session, NOT from the Users sheet - a
 * deliberate choice so the member card still renders when Sheets is
 * slow or down. Barcode drawing is client-side (MemberBarcode).
 */
import { requireUser } from "@/lib/guards";
import AppShell from "@/components/AppShell";
import MemberBarcode from "./MemberBarcode";

const BRANCH_NAME = "名古屋中支部";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

export default async function BarcodePage() {
  const session = await requireUser();

  // member_id + name from session (JWT) directly not from sheet
  // can show even sheet down
  const memberId = session.user.id ?? "";
  const userName = session.user.name ?? "—";

  return (
    <AppShell>
      <div className="page-container">
        <h1 className="mb-4 text-lg font-bold">会員証</h1>

        <div className="card space-y-4">
          <dl className="space-y-3 text-sm">
            <InfoRow label="氏名" value={userName} />
            <InfoRow label="会員ID" value={memberId || "—"} />
            <InfoRow label="所属支部" value={BRANCH_NAME} />
          </dl>

          <div className="border-t border-line pt-4">
            {memberId ? (
              <MemberBarcode memberId={memberId} />
            ) : (
              <p className="text-center text-sm text-ink-muted">会員IDが登録されていません</p>
            )}
          </div>

          <p className="text-center text-[11px] text-danger">
            ※ バーコードは会員本人のみご使用ください。他者への貸与は禁止です。
          </p>
        </div>
      </div>
    </AppShell>
  );
}