"use client"

import dynamic from "next/dynamic";

// pdf.js call browser-only APIs when import -> need to disable SSR
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => <p className="p-8 text-center text-sm text-gray-500">読み込み中…</p>,
});

export default function PdfViewerLoader({ fileUrl }: { fileUrl: string }) {
  return <PdfViewer fileUrl={fileUrl} />;
}