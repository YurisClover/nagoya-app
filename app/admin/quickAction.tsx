import Link from "next/link";

export default function QuickAction() {
  return (
    <div className="w-full lg:w-80 bg-white rounded-lg shadow-sm p-5 h-fit">
      <h2 className="text-base font-bold text-gray-900 pb-4 mb-4 border-b border-gray-100">
        クイックアクション
      </h2>

      <div className="flex flex-col gap-2.5">
        <Link
          href="/admin/users"
          className="block p-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
        >
          新しい会員を登録する
        </Link>

        <Link
          href="/admin/events"
          className="block p-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
        >
          イベントを作成する
        </Link>

        <Link
          href="/admin/messages"
          className="block p-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
        >
          全会員にメッセージを送る
        </Link>

        <Link
          href="/admin/groups"
          className="block p-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
        >
          グループを管理する
        </Link>
      </div>
    </div>
  );
}