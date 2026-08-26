//メッセージ作成・送信を行うフォームコンポーネント

'use client';

import React, { useEffect, useState } from 'react';

type Group = {
  group_id: string;
  group_name: string;
};

type MemberOption = {
  member_id: string;
  user_name: string;
  role: string;
  status: string;
};

interface MessageFormProps {
  groups: Group[];
  /** Logged-in admin's member id; used to keep self out of send targets. */
  currentUserId: string;
  onSuccess: () => void;
  /** グループを事前選択した状態でフォームを開く(/admin/groups の送信リンク用) */
  initialGroupId?: string;
}

export default function MessageForm({ groups, currentUserId, onSuccess, initialGroupId = '' }: MessageFormProps) {
  const [targetType, setTargetType] = useState<'all' | 'group' | 'individual'>(
    initialGroupId ? 'group' : 'all'
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId);

  // グループ名は groups + selectedGroupId から導出できるので state に持たない。
  // (groups は親が非同期で取得するため、state にコピーすると同期漏れが起きる)
  const selectedGroupName =
    groups.find((g) => g.group_id === selectedGroupId)?.group_name ?? '';
  const [individualInput, setIndividualInput] = useState<string>('');
  const [rawTitle, setRawTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // 個人宛先ピッカー用の状態
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberQuery, setMemberQuery] = useState<string>('');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [membersLoaded, setMembersLoaded] = useState<boolean>(false);

  // 個人指定を選んだ時に一度だけ会員一覧を取得する
  useEffect(() => {
    if (targetType !== 'individual' || membersLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/members', { cache: 'no-store' });
        const data = (await res.json()) as { success: boolean; members?: MemberOption[] };
        if (!cancelled && data.success && Array.isArray(data.members)) {
          setMembers(data.members);
          setMembersLoaded(true);
        }
      } catch (err) {
        console.error('会員一覧の取得に失敗しました:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetType, membersLoaded]);

  // 氏名・会員IDで絞り込み(前後空白と全角半角の揺れは normalize しないシンプル一致)
  const q = memberQuery.trim().toLowerCase();
  const filteredMembers = q
    ? members
        .filter(
          (m) =>
            m.user_name.toLowerCase().includes(q) || m.member_id.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  const selectMember = (m: MemberOption) => {
    setIndividualInput(m.member_id);
    setMemberQuery(`${m.user_name}（${m.member_id}）`);
    setShowResults(false);
  };

  const isEightDigitMemberId = /^[0-9]{8}$/.test(individualInput);
  const isIndividualError = targetType === 'individual' && !isEightDigitMemberId;

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  const getPrefix = () => {
    if (targetType === 'all') return '(全会員)';
    if (targetType === 'group') return selectedGroupName ? `(${selectedGroupName})` : '(グループ)';
    return '';
  };

  const getFormattedTitle = () => {
    const prefix = getPrefix();
    return prefix ? `${prefix} ${rawTitle}` : rawTitle;
  };

  const resetForm = () => {
    setRawTitle('');
    setBody('');
    setIndividualInput('');
    setMemberQuery('');
    setShowResults(false);
    setSelectedGroupId('');
    onSuccess();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rawTitle.trim() || !body.trim()) {
      alert('件名と本文を入力してください');
      return;
    }

    setIsSending(true);

    try {
      if (targetType === 'all') {
        // --- 全会員送信 ---
        const res = await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_id: 'all',
            title: getFormattedTitle(),
            body: body,
            url: '/messages',
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // ★ savedCount（成功数）と totalCount（全体数）をアラートに反映
          const saved = data.savedCount ?? data.count ?? 0;
          const total = data.totalCount ?? data.total ?? saved;
          
          alert(`送信が完了しました（全会員の対象者: ${saved} / ${total}名）`);
          resetForm();
        } else {
          alert(`送信エラー: ${data.error || '送信に失敗しました'}`);
        }

      } else if (targetType === 'group') {
        // --- グループ指定送信 ---
        if (!selectedGroupName) {
          alert('グループを選択してください');
          setIsSending(false);
          return;
        }

        // 1. group_name から該当する member_id のリストを取得
        const resGroup = await fetch(
          `/api/group-members?groupName=${encodeURIComponent(selectedGroupName)}&groupId=${selectedGroupId}`
        );
        const groupData = await resGroup.json();

        if (!groupData.success || !Array.isArray(groupData.memberIds) || groupData.memberIds.length === 0) {
          alert(`「${selectedGroupName}」にはメンバーが登録されていません`);
          setIsSending(false);
          return;
        }

        // Skip the sender: a group send targets everyone *else* in the
        // group, matching the server's 'all' behavior.
        const memberIds: string[] = (groupData.memberIds as string[]).filter(
          (id) => id !== currentUserId,
        );
        if (memberIds.length === 0) {
          alert(`「${selectedGroupName}」には自分以外のメンバーがいません`);
          setIsSending(false);
          return;
        }
        let successCount = 0;

        // 2. 抽出された member_id にのみ送信
        for (const memberId of memberIds) {
          const res = await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient_id: memberId, // 確実に抽出されたmember_idのみ送る
              title: getFormattedTitle(),
              body: body,
              url: '/messages',
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            successCount++;
          }
        }

        alert(`送信が完了しました（「${selectedGroupName}」の対象者: ${successCount} / ${memberIds.length}名）`);
        resetForm();

      } else if (targetType === 'individual') {
        // --- 個人指定送信 ---
        if (!isEightDigitMemberId) {
          alert(`【エラー】宛先は半角数字「8桁」の会員IDを入力してください。`);
          setIsSending(false);
          return;
        }

        if (individualInput.trim() === currentUserId) {
          alert('自分自身にはメッセージを送信できません。');
          setIsSending(false);
          return;
        }

        const res = await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_id: individualInput.trim(),
            title: getFormattedTitle(),
            body: body,
            url: '/messages',
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          alert('送信が完了しました');
          resetForm();
        } else {
          alert(`送信エラー: ${data.error || '送信に失敗しました'}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'エラーが発生しました';
      alert(`通信エラー: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-base font-bold text-slate-800 mb-4">メッセージを作成・送信</h3>

      <form onSubmit={handleSend} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">送信先</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as 'all' | 'group' | 'individual')}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="all">全会員</option>
              <option value="group">グループ指定</option>
              <option value="individual">個人指定</option>
            </select>
          </div>

          {targetType === 'group' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">グループ選択</label>
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="">グループを選択してください</option>
                {groups.map((g, index) => {
                  const id = g.group_id || `group_${index}`;
                  return (
                    <option key={id} value={id}>
                      {g.group_name} {id ? `(${id})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {targetType === 'individual' && (
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                宛先を検索（氏名 または 会員ID）
              </label>
              <input
                type="text"
                placeholder="氏名または会員IDを入力して選択"
                value={memberQuery}
                onChange={(e) => {
                  setMemberQuery(e.target.value);
                  setShowResults(true);
                  // 手入力で内容が変わったら、確定済みの宛先IDはいったんクリア
                  setIndividualInput('');
                }}
                onFocus={() => setShowResults(true)}
                className={`w-full p-2.5 bg-slate-50 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                  isIndividualError
                    ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-slate-500'
                }`}
              />

              {/* 絞り込み結果のドロップダウン */}
              {showResults && q && (
                <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                  {filteredMembers.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-400">
                      {membersLoaded ? '該当する会員が見つかりません' : '読み込み中...'}
                    </li>
                  ) : (
                    filteredMembers.map((m) => (
                      <li key={m.member_id}>
                        <button
                          type="button"
                          onClick={() => selectMember(m)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                        >
                          <span className="font-medium text-slate-800">{m.user_name}</span>
                          <span className="text-xs text-slate-500 font-mono">{m.member_id}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}

              {/* 確定済みの宛先を表示 */}
              {isEightDigitMemberId && !showResults && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  宛先: {individualInput}
                </p>
              )}
              {isIndividualError && (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  ※ 一覧から会員を選択してください
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">件名</label>
          <div className="flex items-center space-x-2">
            {getPrefix() && (
              <span className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 whitespace-nowrap">
                {getPrefix()}
              </span>
            )}
            <input
              type="text"
              placeholder="件名を入力してください"
              value={rawTitle}
              onChange={(e) => setRawTitle(e.target.value)}
              className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">本文</label>
          <textarea
            rows={5}
            placeholder="メッセージ本文を入力してください..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 resize-y"
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={() =>
              alert(`【送信予定の件名】\n${getFormattedTitle() || '(未入力)'}\n\n【本文】\n${body || '(未入力)'}`)
            }
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            プレビュー
          </button>
          <button
            type="submit"
            disabled={isSending || isIndividualError}
            className="px-6 py-2 bg-[#1b365d] hover:bg-[#142845] text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? '送信中...' : '送信する'}
          </button>
        </div>
      </form>
    </section>
  );
}