'use client';

import React, { useState, useEffect } from 'react';

// 型定義
type Group = {
  group_id: string;
  group_name: string;
};

type ReceivedMessage = {
  id: string;
  senderId: string;
  userName: string;
  subject: string;
  body: string;
  isRead: boolean; // 既読フラグ (未読は false)
  createdAt: string;
};

export default function AdminMessagePage() {
  // --- 状態管理 (送信フォーム) ---
  const [targetType, setTargetType] = useState<'all' | 'group' | 'individual'>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [individualInput, setIndividualInput] = useState<string>('');

  const [rawTitle, setRawTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // --- 状態管理 (受信メッセージ) ---
  const [inquiries, setInquiries] = useState<ReceivedMessage[]>([]);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState<boolean>(true);

  // 1. 初回描画時に Groups 一覧 & 管理者宛てメッセージ を取得
  useEffect(() => {
    async function fetchData() {
      // グループ一覧取得
      try {
        const res = await fetch('/api/groups');
        const data = await res.json();
        if (data.success && Array.isArray(data.groups)) {
          const formattedGroups = data.groups.map((g: any) => ({
            group_id: g.group_id || g.id || '',
            group_name: g.group_name || g.name || '名称未設定グループ',
          }));
          setGroups(formattedGroups);
        }
      } catch (err) {
        console.error('グループ一覧の取得に失敗しました:', err);
      }

      // 受信メッセージ（管理者宛て問い合わせ）取得
      try {
        setIsLoadingInquiries(true);
        const res = await fetch('/api/admin/inquiries');
        const data = await res.json();
        if (data.success && Array.isArray(data.inquiries)) {
          setInquiries(data.inquiries);
        }
      } catch (err) {
        console.error('受信メッセージの取得に失敗しました:', err);
      } finally {
        setIsLoadingInquiries(false);
      }
    }

    fetchData();
  }, []);

  // 2. グループ選択のハンドラ
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const target = groups.find((g) => g.group_id === groupId);
    setSelectedGroupName(target ? target.group_name : '');
  };

  // 3. 件名プレフィックスの動的生成
  const getPrefix = () => {
    if (targetType === 'all') return '(全会員)';
    if (targetType === 'group') return selectedGroupName ? `(${selectedGroupName})` : '(グループ)';
    return '';
  };

  const getFormattedTitle = () => {
    const prefix = getPrefix();
    return prefix ? `${prefix} ${rawTitle}` : rawTitle;
  };

  // 4. メッセージ送信処理
  const handleSend = async (e: React.FormEvent) => {
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
        alert('宛先（member_id または 氏名）を入力してください');
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
          // sender_id は送らず、API 側で auth() から自動取得
          recipient_id: recipientId,
          title: getFormattedTitle(),
          body: body,
          url: '/messages',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert(`送信が完了しました（送信対象: ${data.savedCount || 1}名）`);
        setRawTitle('');
        setBody('');
      } else {
        alert(`送信エラー: ${data.error || `サーバーエラー (Status: ${res.status})`}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`送信処理中にエラーが発生しました: ${err.message || '通信エラー'}`);
    } finally {
      setIsSending(false);
    }
  };

  // 問い合わせへの「返信」ボタン押下時
  const handleReply = (inquiry: ReceivedMessage) => {
    setTargetType('individual');
    setIndividualInput(inquiry.senderId);
    setRawTitle(`Re: ${inquiry.subject}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ★ 未読件数の算出
  const unreadCount = inquiries.filter((item) => !item.isRead).length;

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <h2 className="text-2xl font-bold text-slate-900">メッセージ管理</h2>

      {/* --- カード1: メッセージを作成・送信 --- */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-base font-bold text-slate-800 mb-4">メッセージを作成・送信</h3>

        <form onSubmit={handleSend} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                送信先
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="all">全会員</option>
                <option value="group">グループ指定</option>
                <option value="individual">個人指定</option>
              </select>
            </div>

            {targetType === 'group' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  グループ選択
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">グループを選択してください</option>
                  {groups.map((g, index) => {
                    const id = g.group_id || `group_${index}`;
                    const name = g.group_name || '名称未設定グループ';
                    return (
                      <option key={id} value={id}>
                        {name} {id ? `(${id})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {targetType === 'individual' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  宛先 (会員ID または 氏名)
                </label>
                <input
                  type="text"
                  placeholder="例: MEM_001 または 田中 一郎"
                  value={individualInput}
                  onChange={(e) => setIndividualInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              件名
            </label>
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
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              本文
            </label>
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
              disabled={isSending}
              className="px-6 py-2 bg-[#1b365d] hover:bg-[#142845] text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isSending ? '送信中...' : '送信する'}
            </button>
          </div>
        </form>
      </section>

      {/* --- カード2: 受信メッセージ（会員からの問い合わせ） --- */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <h3 className="text-base font-bold text-slate-800">
            受信メッセージ（会員からの問い合わせ）
          </h3>

          {/* 未読が1件以上あれば全体カウントバッジを表示 */}
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              未読 {unreadCount}件
            </span>
          )}
        </div>

        {isLoadingInquiries ? (
          <p className="text-sm text-slate-500 py-4">読み込み中...</p>
        ) : inquiries.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">管理者宛てのメッセージはありません</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {inquiries.map((item) => (
              <div
                key={item.id}
                className={`py-4 flex items-start justify-between px-3 rounded-lg transition ${
                  !item.isRead ? 'bg-amber-50/50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* アバター */}
                  <div className="w-10 h-10 rounded-full bg-[#1b365d] text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    {item.userName ? item.userName.charAt(0) : 'U'}
                  </div>

                  <div>
                    {/* 1行目: 送信者情報 + 未読バッジ */}
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{item.userName}</span>
                      <span className="text-xs text-slate-500">（{item.senderId}）</span>

                      {!item.isRead && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                          未読
                        </span>
                      )}
                    </div>

                    {/* 2行目: 件名 */}
                    <p className={`text-sm mt-1 ${!item.isRead ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                      {item.subject}
                    </p>

                    {/* 3行目: 日時 */}
                    <span className="text-xs text-slate-400 mt-1 block">{item.createdAt}</span>
                  </div>
                </div>

                {/* 返信ボタン */}
                <button
                  onClick={() => handleReply(item)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded bg-white hover:bg-slate-50 transition"
                >
                  返信
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}