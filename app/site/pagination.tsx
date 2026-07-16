'use client';

import { useState } from "react";
import PdfList from "./pdfList";
import "./pagination.css";
import PdfFile from "./type";
import ReactPaginate from "react-paginate";

type Props = {
  pdfList: PdfFile[];
};

const Pagination = (props: Props) => {
  const {pdfList} = props;

  const itemsPerPage = 10;

  const [itemsOffset, setItemsOffset] = useState(0);

  const endOffset = itemsOffset + itemsPerPage;

  const currentPdfList = pdfList.slice(itemsOffset, endOffset);
  const pageCount = Math.ceil(pdfList.length / itemsPerPage);

  const handlePageClick = (e:{ selected: number}) => {
    const newOffset = (e.selected * itemsPerPage) % pdfList.length;
    setItemsOffset(newOffset);
  };

  return (
   <div>
    <PdfList pdfList={pdfList} currentPdfList={currentPdfList}/>
    <ReactPaginate pageCount={pageCount} onPageChange={handlePageClick}
    // 全体を囲うコンテナ（横並びにして中央寄せ、隙間を空ける）
  containerClassName="flex items-center justify-center space-x-2 my-8"

  // 各ページ番号のボタン
  pageClassName="border rounded hover:bg-gray-100"
  pageLinkClassName="block px-4 py-2 text-sm text-gray-700"

  // アクティブ（現在選択中）のページ
  activeClassName="bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
  activeLinkClassName="text-white" // アクティブ時の文字色を白に固定

  // 「前へ」「次へ」のボタン
  previousClassName="border rounded hover:bg-gray-100"
  previousLinkClassName="block px-3 py-2 text-sm text-gray-700"
  nextClassName="border rounded hover:bg-gray-100"
  nextLinkClassName="block px-3 py-2 text-sm text-gray-700"

  // 「前へ」「次へ」のテキスト（記号）
  previousLabel="&lt;"
  nextLabel="&gt;"

  // 三点リーダー（...）の部分
  breakClassName="text-gray-400"
  breakLinkClassName="block px-3 py-2"
    />
   </div>
  );
};
 export default Pagination;
