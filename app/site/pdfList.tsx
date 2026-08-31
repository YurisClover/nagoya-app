import Link from "next/link";
import PdfFile from "./type";
import { FileText, ChevronRight } from "lucide-react";

type Props = {
  pdfList: PdfFile[];
  currentPdfList: PdfFile[];
};

const PdfList = ({ pdfList: allPdfList, currentPdfList }: Props) => {
  // 1. 全体のリストを「作成日が新しい順（降順）」に並び替えて、最新の2件を取得する
  // 2. 最新2件の「IDだけ」をまとめた配列を作る
  const latestIds = [...allPdfList]
    .sort(
      (a, b) =>
        new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime(),
    )
    .slice(0, 2)
    .map((pdf) => pdf.id);

  return (
    <ul className="space-y-2">
      {currentPdfList.map((pdf) => (
        <li key={pdf.id}>
          <Link
            href={`/site/view/${pdf.id}`}
            className="card-tap flex items-center gap-3"
          >
            <span className="icon-tile tone-navy mb-0 shrink-0">
              <FileText size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{pdf.name}</span>
                {latestIds.includes(pdf.id) && (
                  <span className="badge shrink-0">NEW</span>
                )}
              </span>
              <span className="text-meta">
                公開日: {new Date(pdf.createdTime).toLocaleDateString("ja-JP")}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-ink-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default PdfList;
