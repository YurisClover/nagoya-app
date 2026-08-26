"use client"

import { useState } from "react";
import { EventAttendanceItem } from "@/lib/sheets";
import { formatEventSchedule } from "@/lib/datetime";

type EventAttendanceProps = {
  items: EventAttendanceItem[];
};

export default function EventAttendance({ items }: EventAttendanceProps) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  // Items arrive pre-sorted by event date (see getEventAttendanceList).
  // Do not sort by eventId here: it is a UUID, not a sequence number.
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="bg-white rounded-lg shadow-sm p-5 mt-6 w-full">
      <div className="pb-4 mb-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">
          今月のイベント出席状況
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          今月のイベントはありません
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm text-gray-600 border-collapse">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
              <tr>
                <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                イベント名
              </th>
              <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                開催日
              </th>
              <th scope="col" className="w-20 py-3 px-4 font-semibold text-center whitespace-nowrap">
                登録数
              </th>
            </tr>
          </thead>
            <tbody className="divide-y divide-gray-100">
                {pageItems.map((item) => {
                const linkable = Boolean(item.formUrl);
                const schedule = formatEventSchedule(item.eventDate, undefined, {
                    yearHint: "current",
                });
                return (
                    <tr key={item.eventId} className="hover:bg-gray-50/50">
                    {/* 1. イベント名（クリックでフォームへ） */}
                    <td className="py-1 px-4 font-medium">
                        {linkable ? (
                        <a
                            href={item.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block max-w-[350px] truncate py-2.5 text-brand underline-offset-2 hover:underline"
                        >
                            {item.title}
                        </a>
                        ) : (
                        <span className="block max-w-[350px] truncate py-2.5 text-gray-900">
                            {item.title}
                        </span>
                        )}
                    </td>

                    {/* 2. 開催日（同じくクリック可） */}
                    <td className="py-1 px-4 text-gray-500 whitespace-nowrap">
                        {linkable ? (
                        <a
                            href={item.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate py-2.5 underline-offset-2 hover:underline"
                        >
                            {schedule}
                        </a>
                        ) : (
                        <span className="block py-2.5">{schedule}</span>
                        )}
                    </td>

                    {/* 3. 登録数 */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        {item.registrationCount} 名
                        </span>
                    </td>
                    </tr>
                );
                })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-3 text-xs">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn btn-secondary px-3 py-1 text-xs disabled:opacity-50"
              >
                前へ
              </button>
              <span className="text-ink-muted">
                {page} / {totalPages} ページ
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-secondary px-3 py-1 text-xs disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}