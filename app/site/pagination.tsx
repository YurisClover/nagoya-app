'use client';

import { useState } from "react";
import PdfList from "./pdfList";
import "./pagination.css";
import PdfFile from "./type";
import ReactPaginate from "react-paginate";

type Props = {
  //親コンポーネントから渡される、すべてのPDFが入った配列
  pdfList: PdfFile[];
};
//ページネーションの計算
const Pagination = (props: Props) => {
  // 親から受け取ったプロパティ（props）から、すべてのPDF一覧（pdfList）を取り出す
  const {pdfList} = props;

  // 1ページあたりに表示したいPDFの件数（10件）
  const itemsPerPage = 10;

  // 現在のページで、PDFを「何件目から」表示するか（開始位置）を管理する状態（初期値は0件目）
  const [itemsOffset, setItemsOffset] = useState(0);

  // 現在のページで、PDFを「何件目まで」表示するかの位置（開始位置 + 10件）
  const endOffset = itemsOffset + itemsPerPage;
  
  // 全体のPDFリストから、現在表示する「10件分だけ」を切り抜く
  const currentPdfList = pdfList.slice(itemsOffset, endOffset);
  // 全体の件数 ÷ 1ページあたりの件数 を計算し、小数点以下を切り上げて総ページ数を出す
  const pageCount = Math.ceil(pdfList.length / itemsPerPage);

  // ページ番号のボタンがクリックされたときに動く処理（e.selected にはクリックされたページ番号が入る。0からスタート）
  const handlePageClick = (e:{ selected: number}) => {
    // クリックされたページ番号から、次に切り抜くスタート位置（Offset）を計算する
    const newOffset = (e.selected * itemsPerPage) % pdfList.length;
    // 計算した新しいスタート位置を状態（itemsOffset）に保存して、表示を更新する
    setItemsOffset(newOffset);
  };

  return (
   <div>
    {/* 10件分に切り抜いたリスト（currentPdfList）と、全体リスト（pdfList）を、表示用コンポーネントに渡す */}
    <PdfList pdfList={pdfList} currentPdfList={currentPdfList}/>

    {/* ページめくりのボタン（ReactPaginateライブラリ）を表示する */}
    <ReactPaginate 
      pageCount={pageCount}  // 総ページ数を渡す
      onPageChange={handlePageClick}  // ページがクリックされたときの処理を登録

    // --- ここから下はデザイン用のクラス名（CSS）の設定 ---
    
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
