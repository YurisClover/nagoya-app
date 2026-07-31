/*'use client';

import { useState, useEffect } from 'react';

type Group = {
  group_id: string;
  group_name: string;
};

interface SendMessageFormProps {
  onSuccess?: () => void;
}

export default function SendMessageForm({ onSuccess }: SendMessageFormProps) {
  const [targetType, setTargetType] = useState<'all' | 'group' | 'individual'>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [individualInput, setIndividualInput] = useState<string>(''); // member_id (半角数字8桁)

  const [rawTitle, setRawTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // 初回ロード時に Groups シートからグループ一覧を取得
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups');
        const data = await res.json();
        if (data.success) {
          setGroups(data.groups || []);
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
    return rawTitle;
  };

  // ★ 入力値の変更ハンドラー（数字以外はカット）
  const handleIndividualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 数字以外の文字を除去（全角数字や記号・文字をカット）
    const onlyNums = e.target.value.replace(/\D/g, '');
    // 8桁を超える入力はカット
    setIndividualInput(onlyNums.slice(0, 8));
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
      const cleanInput = individualInput.trim();

      // ★ 厳格バリデーション: 「完全な半角数字8桁」でない場合は絶対中断
      const isExactlyEightDigits = /^[0-9]{8}$/.test(cleanInput);

      if (!isExactlyEightDigits) {
        alert(`【エラー】member_id は半角数字「8桁」で指定してください。\n(入力された値: "${cleanInput}" / 文字数: ${cleanInput.length}桁)`);
        return; // ★ 絶対にここで処理を終了する
      }

      recipientId = cleanInput;
    }

    setIsSending(true);

    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: 'admin',
          recipientId: recipientId,
          title: getFormattedTitle(),
          body: body,
          url: '/messages',
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`送信が完了しました（対象: ${data.savedCount ?? 1}名）`);
        setRawTitle('');
        setBody('');
        setIndividualInput('');
        if (onSuccess) onSuccess();
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

  // 個人指定かつ8桁に満たない場合のエラーフラグ
  const isIndividualInvalid =
    targetType === 'individual' && individualInput.length !== 8;

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow space-y-4 max-w-2xl">
      <h2 className="text-xl font-bold mb-4 text-slate-800">メッセージを作成・送信</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 送信先種別プルダウン */}
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">送信先</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as any)}
            className="w-full p-2 border rounded bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="all">全会員</option>
            <option value="group">グループ指定</option>
            <option value="individual">個人指定</option>
          </select>
        </div>

        {/* グループ指定時 */}
        {targetType === 'group' && (
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">グループを選択</label>
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full p-2 border rounded bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
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

        {/* 個人指定時 */}
        {targetType === 'individual' && (
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">
              宛先 (member_id / 半角数字8桁)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="例: 10001234"
              value={individualInput}
              onChange={handleIndividualInputChange}
              className={`w-full p-2 border rounded focus:outline-none focus:ring-2 font-mono ${
                isIndividualInvalid
                  ? 'border-red-500 focus:ring-red-500 bg-red-50'
                  : 'border-slate-300 focus:ring-slate-500'
              }`}
            />
            {isIndividualInvalid && (
              <p className="text-xs text-red-600 mt-1 font-semibold">
                ※ 半角数字「8桁」を入力してください (現在 {individualInput.length} 桁)
              </p>
            )}
          </div>
        )}
      </div>

      {/* 件名入力欄 */}
      <div>
        <label className="block text-sm font-medium mb-1 text-slate-700">件名</label>
        <div className="flex items-center space-x-1">
          {targetType === 'all' && (
            <span className="bg-slate-100 text-slate-700 px-3 py-2 rounded border text-sm font-bold whitespace-nowrap">
              (全会員)
            </span>
          )}
          {targetType === 'group' && (
            <span className="bg-slate-100 text-slate-700 px-3 py-2 rounded border text-sm font-bold whitespace-nowrap">
              ({selectedGroupName || 'グループ名'})
            </span>
          )}
          <input
            type="text"
            placeholder="件名を入力してください"
            value={rawTitle}
            onChange={(e) => setRawTitle(e.target.value)}
            className="w-full p-2 border rounded border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
      </div>

      {/* 本文入力欄 */}
      <div>
        <label className="block text-sm font-medium mb-1 text-slate-700">本文</label>
        <textarea
          rows={4}
          placeholder="メッセージ本文を入力してください..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full p-2 border rounded border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 resize-y"
        />
      </div>

      {/* 件名送信プレビュー */}
      <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200">
        実際の送信件名: <span className="font-semibold text-slate-800">{getFormattedTitle() || '(未入力)'}</span>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSending || isIndividualInvalid}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? '送信中...' : '送信する'}
        </button>
      </div>
    </form>
  );
}*/