import "./pdfList.css";
import "./pagination.css";
import PdfFile from "./type";

type Props = {
  pdfList: PdfFile[];
  currentPdfList: PdfFile[];
};

const pdfList = (props: Props) => {
  const { pdfList: allPdfList, currentPdfList } = props;

  // 1. 全体のリストを「作成日が新しい順（降順）」に並び替えて、最新の2件を取得する
  const latestTwoPdfs = [...allPdfList]
    .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
    .slice(0, 2);

  // 2. 最新2件の「IDだけ」をまとめた配列を作る
  const latestIds = latestTwoPdfs.map((pdf) => pdf.id);

  return (
    <ul className="space-y-3">
      {currentPdfList.map((pdf) => {
        // 3. 今ループ処理しているPDFのIDが、最新2件のIDの中に含まれているかチェック
        const isNew = latestIds.includes(pdf.id);

        return (
          <li 
            key={pdf.id} 
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div>
              <span className="font-medium text-blue-600 flex items-center gap-2 mb-1">
                {/*  PDFの名前 */}
                <span>{pdf.name}</span>
                
                {/* もし最新2件だったら、ここにNEWバッジを表示する */}
                {isNew && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">
                    NEW
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-400">
                公開日: {new Date(pdf.createdTime).toLocaleDateString('ja-JP')}
              </span>
            </div>
            <a
              href={`/api/pdf/${pdf.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              開く
            </a>
          </li>
        );
      })}
    </ul>
  );
};

export default pdfList;

