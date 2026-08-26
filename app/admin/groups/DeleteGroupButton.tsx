/**
 * Confirm-wrapped submit for group deletion. The destructive action
 * itself is a bound server action passed in as a prop; this component
 * only adds the confirm() gate.
 */
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
        className="btn btn-danger px-3 py-1.5 text-xs"
      >
        削除
      </button>
    </form>
  );
}