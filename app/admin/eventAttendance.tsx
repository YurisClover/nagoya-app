import { EventAttendanceItem } from "@/lib/sheets";
import { formatEventSchedule } from "@/lib/datetime";

type EventAttendanceProps = {
  items: EventAttendanceItem[];
};

export default function EventAttendance({ items }: EventAttendanceProps) {
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
          <table className="w-full text-left text-sm text-gray-600 border-collapse">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
              <tr>
                <th scope="col" className="py-3 px-4 font-semibold w-1/4">
                  イベント名
                </th>
                <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">
                  開催日
                </th>
                <th scope="col" className="py-3 px-4 font-semibold text-center whitespace-nowrap">
                  登録数
                </th>
                <th scope="col" className="py-3 px-4 font-semibold">
                  フォームURL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.eventId} className="hover:bg-gray-50/50">
                  {/* 1. イベント名 */}
                  <td className="py-3.5 px-4 font-medium text-gray-900">
                    {item.title}
                  </td>

                  {/* 2. 開催日 */}
                  <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                    {formatEventSchedule(item.eventDate, undefined, { yearHint: "current" })}
                  </td>

                  {/* 3. 登録数 */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                      {item.registrationCount} 名
                    </span>
                  </td>

                  {/* 4. フォームURL（生のURLをそのままリンク表示） */}
                  <td className="py-3.5 px-4">
                    {item.formUrl ? (
                      <a
                        href={item.formUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline break-all font-mono inline-block max-w-[120px] truncate align-bottom text-brand"
                      >
                        {item.formUrl}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">なし</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}