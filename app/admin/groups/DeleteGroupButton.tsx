"use client";

export default function DeleteGroupButton({
  action,
  groupName,
}: {
  action: () => Promise<void>;
  groupName: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`グループ「${groupName}」を削除しますか？\nメンバー設定も一緒に削除されます。`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="px-3 py-1.5 border border-red-200 text-xs font-medium rounded text-red-600 hover:bg-red-50"
      >
        削除
      </button>
    </form>
  );
}