/**
 * Shared pagination control (react-paginate) used by both message lists.
 * Stateless: parent owns currentPage (0-based) and receives onPageChange.
 */
"use client";

import ReactPaginate from "react-paginate";

const pageBtn =
  "flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-sm text-ink-muted transition hover:bg-surface-muted";

type Props = {
  pageCount: number;
  /** 0始まりのページ番号 */
  currentPage: number;
  onPageChange: (page: number) => void;
};

// app/site/pagination.tsx と同じ見た目のページ送りUI。
// あちらは PdfList と密結合しているため、リスト本体を持たない
// 汎用版としてここに切り出した(メッセージ一覧の user/admin 両方で使う)。
export default function PagerControls({ pageCount, currentPage, onPageChange }: Props) {
  if (pageCount <= 1) return null;

  return (
    <ReactPaginate
      pageCount={pageCount}
      forcePage={currentPage}
      onPageChange={({ selected }) => onPageChange(selected)}
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
  );
}
