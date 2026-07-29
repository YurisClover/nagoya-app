'use client';

import { useState, useEffect } from 'react';

type Group = {
  group_id: string;
  group_name: string;
};

export default function SendMessageForm() {
  const [targetType, setTargetType] = useState<'all' | 'group' | 'individual'>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [individualInput, setIndividualInput] = useState<string>(''); // member_id または ユーザー名

  const [rawTitle, setRawTitle] = useState<string>(''); // 入力された本文件名（例: 次回会議について）
  const [body, setBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // 初回ロード時に Groups シートからグループ一覧を取得
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups');
        const data = await res.json();
        if (data.success) {
          setGroups(data.groups);
        }
      } catch (err) {
        console.error('グループの取得に失敗しました', err);
      }
    }
    fetchGroups();
  }, []);

  // グループ選択時の処理
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const targetGroup = groups.find((g) => g.group_id === groupId);
    setSelectedGroupName(targetGroup ? targetGroup.group_name : '');
  };

  // 送信される最終的な件名を計算
  const getFormattedTitle = () => {
    if (targetType === 'all') {
      return `(全会員)${rawTitle}`;
    } else if (targetType === 'group') {
      const prefix = selectedGroupName ? `(${selectedGroupName})` : '(グループ)';
      return `${prefix}${rawTitle}`;
    }
    return rawTitle; // 個人指定の場合はプレフィックスなし
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rawTitle.trim() || !body.trim()) {
      alert('件名と本文を入力してください');
      return;
    }

    let recipientId = 'all';
    if (targetType === 'group') {
      if (!selectedGroupId) {
        alert('グループを選択してください');
        return;
      }
      recipientId = selectedGroupId;
    } else if (targetType === 'individual') {
      if (!individualInput.trim()) {
        alert('member_id または ユーザー名を入力してください');
        return;
      }
      recipientId = individualInput.trim();
    }

    setIsSending(true);

    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: 'admin',
          recipientId: recipientId,
          title: getFormattedTitle(), // 🌟 (執行部)次回会議について の形で送信
          body: body,
          url: '/messages',
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`送信が完了しました（対象: ${data.savedCount}名）`);
        setRawTitle('');
        setBody('');
      } else {
        alert(`エラー: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('送信処理中にエラーが発生しました');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow space-y-4 max-w-2xl">
      <h2 className="text-xl font-bold mb-4">メッセージを作成・送信</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 送信先種別プルダウン */}
        <div>
          <label className="block text-sm font-medium mb-1">送信先</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as any)}
            className="w-full p-2 border rounded"
          >
            <option value="all">全会員</option>
            <option value="group">グループ指定</option>
            <option value="individual">個人指定</option>
          </select>
        </div>

        {/* グループ指定時に表示されるグループ名プルダウン */}
        {targetType === 'group' && (
          <div>
            <label className="block text-sm font-medium mb-1">グループを選択</label>
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">グループを選択してください</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 個人指定時に表示される入力欄 */}
        {targetType === 'individual' && (
          <div>
            <label className="block text-sm font-medium mb-1">宛先 (member_id または ユーザー名)</label>
            <input
              type="text"
              placeholder="例: 10001235 または 田中 一郎"
              value={individualInput}
              onChange={(e) => setIndividualInput(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        )}
      </div>

      {/* 件名入力欄（プレフィックスプレビュー付き） */}
      <div>
        <label className="block text-sm font-medium mb-1">件名</label>
        <div className="flex items-center space-x-1">
          {targetType === 'all' && (
            <span className="bg-gray-100 text-gray-700 px-3 py-2 rounded border text-sm font-bold whitespace-nowrap">
              (全会員)
            </span>
          )}
          {targetType === 'group' && (
            <span className="bg-gray-100 text-gray-700 px-3 py-2 rounded border text-sm font-bold whitespace-nowrap">
              ({selectedGroupName || 'グループ名'})
            </span>
          )}
          <input
            type="text"
            placeholder="件名を入力してください"
            value={rawTitle}
            onChange={(e) => setRawTitle(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>

      {/* 本文入力欄 */}
      <div>
        <label className="block text-sm font-medium mb-1">本文</label>
        <textarea
          rows={4}
          placeholder="メッセージ本文を入力してください..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      {/* 件名送信プレビュー */}
      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
        実際の送信件名: <span className="font-semibold text-gray-800">{getFormattedTitle() || '(未入力)'}</span>
      </div>

      <button
        type="submit"
        disabled={isSending}
        className="px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
      >
        {isSending ? '送信中...' : '送信する'}
      </button>
    </form>
  );
}