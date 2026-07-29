"use client";

import { useState } from "react";
import ReactPaginate from "react-paginate";
import PdfList from "./pdfList";
import PdfFile from "./type";

type Props = { 
    //親コンポーネントから渡される、すべてのPDFが入った配列
    pdfList: PdfFile[] 
};

const ITEMS_PER_PAGE = 10;  // 1ページあたりに表示したいPDFの件数（10件）
const pageBtn =
  "flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-sm text-ink-muted transition hover:bg-surface-muted";

const Pagination = ({ pdfList }: Props) => {
  const [currentPage, setCurrentPage] = useState(0);

  const pageCount = Math.ceil(pdfList.length / ITEMS_PER_PAGE);
  const offset = currentPage * ITEMS_PER_PAGE;
  const currentPdfList = pdfList.slice(offset, offset + ITEMS_PER_PAGE);

  return (
    <div>
      <PdfList pdfList={pdfList} currentPdfList={currentPdfList} />

      {pageCount > 1 && (
        <ReactPaginate
          pageCount={pageCount}
          forcePage={currentPage}
          onPageChange={({ selected }) => setCurrentPage(selected)}
          pageRangeDisplayed={3}
          marginPagesDisplayed={1}
          previousLabel="‹"
          nextLabel="›"
          breakLabel="…"
          containerClassName="mt-5 flex items-center justify-center gap-1"
          pageLinkClassName={pageBtn}
          previousLinkClassName={pageBtn}
          nextLinkClassName={pageBtn}
          breakLinkClassName={pageBtn}
          activeLinkClassName="!bg-brand !text-white hover:!bg-brand-light"
          disabledLinkClassName="pointer-events-none opacity-40"
          renderOnZeroPageCount={null}
        />
      )}
    </div>
  );
};

export default Pagination;