import { listNewsletterPdfs } from "@/lib/drive";
import AppShell from "@/components/AppShell";
import Pagination from "./pagination";
import { Building2, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/guards";

function OfficialSiteCard() {
  return (
    <a href="https://www.taxnaka.com/" target="_blank" rel="noopener noreferrer"
       className="card-tap flex items-center gap-3">
      <span className="icon-tile tone-navy mb-0 shrink-0">
        <Building2 size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">支部公式ホームページ</span>
        <span className="text-meta">taxnaka.com を開く</span>
      </span>
      <ExternalLink size={16} className="shrink-0 text-ink-muted" />
    </a>
  );
}

export default async function PdfListPage() {
  await requireUser();

  let pdfList;
  try {
    pdfList = await listNewsletterPdfs();
  } catch (error) {
    console.error(error);
    return (
      <AppShell>
        <div className="page-container">
          <h1 className="mb-6 text-lg font-bold">中支部サイト・支部報</h1>
          <OfficialSiteCard />
          <div className="card mt-6 text-center">
            <p className="text-sm text-danger">支部報の一覧を取得できませんでした。</p>
            <p className="text-meta mt-1">時間をおいて再度お試しください。</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-container">
        <h1 className="mb-6 text-lg font-bold">中支部サイト・支部報</h1>

        <OfficialSiteCard />

        <h2 className="section-title mt-8">支部報（PDF）</h2>
        {pdfList.length === 0 ? (
          <p className="text-meta py-6 text-center">公開されている支部報はまだありません。</p>
        ) : (
          <Pagination pdfList={pdfList} />
        )}
      </div>
    </AppShell>
  );
}