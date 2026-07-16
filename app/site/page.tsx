import PdfFile from "./type";
import Pagination from "./pagination";

function Site() {
  return (
    <div className="mb-6">
      <a 
        href="https://www.taxnaka.com/" 
        className="text-blue-500 hover:underline text-sm font-medium"
      >
        支部公式ホームページへ
      </a>
    </div>
  );
}

// サーバーの中で直接PDF一覧を取得して表示させる。
export default async function PdfListPage() {
 
  //データを取得しに行くAPIのURLの場所
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/pdf-list`;
   //サーバーサイドで直接データを取得
  const response = await fetch(apiUrl, {
    // 毎回Googleの最新状態をチェックするためにキャッシュを無効化
    cache: 'no-store' 
  });

  //一覧が取得できなかった場合の処理
  if (!response.ok) {
    return (
      <main className="max-w-4xl mx-auto p-8">
        <Site />
        <div className="p-8 text-center text-red-500 border border-red-200 rounded-lg bg-red-50">
          ⚠️ PDF一覧の取得に失敗しました。時間をおいて再度お試しください。
        </div>
      </main>
    );
  }

  //jsonの変換が終わるまで次に行かない、PDFの配列をpdfListに格納する
  const pdfList: PdfFile[] = await response.json();
  //完成したHTMLをブラウザに表示
  return (
    <main className="max-w-4xl mx-auto p-8">
      
      <Site />

      <h1 className="text-2xl font-bold mb-6 border-b pb-2">📄 配布されたPDF（支部報）一覧</h1>

      {pdfList.length === 0 ? (
        <p className="text-gray-500">公開されているPDFはありません。</p>
      ) : (
        <Pagination pdfList={pdfList}/>
      )}
    </main>
  );
}





  
