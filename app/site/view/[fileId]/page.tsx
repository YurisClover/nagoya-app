import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import AppShell from "@/components/AppShell";
import PdfViewerLoader from "@/components/PdfViewerLoader";

export default async function PdfViewPage({
  params,
}: {
  params: Promise<{ fileId: string }>; 
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { fileId } = await params;

  return (
    <AppShell>
      <div className="page-container">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/site"
            className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <ChevronLeft size={16} className="shrink-0" />
            一覧へ戻る
          </Link>
          <a
            href={`/api/pdf/${fileId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-meta inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
          >
            <ExternalLink size={14} className="shrink-0" />
            別タブで開く
          </a>
        </div>
        <PdfViewerLoader fileUrl={`/api/pdf/${fileId}`} />
      </div>
    </AppShell>
  );
}