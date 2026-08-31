"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function PdfViewer({ fileUrl }: { fileUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      {error ? (
        <p className="p-8 text-center text-sm text-red-600">
          PDFを読み込めませんでした。時間をおいて再度お試しください。
        </p>
      ) : (
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setError(true)}
          loading={
            <p className="p-8 text-center text-sm text-gray-500">読み込み中…</p>
          }
        >
          {width > 0 &&
            Array.from({ length: numPages }, (_, i) => (
              <Page
                key={i}
                pageNumber={i + 1}
                width={width}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="mb-2 shadow-sm"
              />
            ))}
        </Document>
      )}
    </div>
  );
}
