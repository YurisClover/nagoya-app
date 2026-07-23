import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listNewsletterPdfs } from "@/lib/drive";
import Pagination from "./pagination";
import AppShell from "@/components/AppShell";

function SiteLink() {
  return (
    <div className="mb-6">
      <a href="https://www.taxnaka.com/" className="text-blue-500 hover:underline text-sm font-medium">サイトへ</a>
    </div>
  );
}

export default async function PdfListPage() {
  const session = await auth();          // defense in depth (dynamic)
  if (!session) redirect("/login");

  let pdfList;
  try {
    pdfList = await listNewsletterPdfs(); // call drive from server
  } catch (error) {
    console.error(error);
    return (
      <main className="max-w-4xl mx-auto p-8">
        <SiteLink />
        <div className="p-8 text-center text-red-500 border border-red-200 rounded-lg bg-red-50">
          ⚠️ PDF一覧の取得に失敗しました。時間をおいて再度お試しください。
        </div>
      </main>
    );
  }

  return (
    <AppShell>
      <SiteLink />
      <h1 className="text-2xl font-bold mb-6 border-b pb-2">📄 配布されたPDF（支部報）一覧</h1>
      {pdfList.length === 0
        ? <p className="text-gray-500">公開されているPDFはありません。</p>
        : <Pagination pdfList={pdfList} />}
    </AppShell>
  );
}