'use client';

import { useState } from 'react';

// 仮のログインユーザー（実際は AuthContext やセッションから取得する loggedInUser.member_id を利用）
const CURRENT_ADMIN_ID = 'MEM_ADMIN_001';

export default function SendMessageForm() {
  // フォームの状態管理
  const [recipientType, setRecipientType] = useState<'all' | 'executive' | 'group' | 'user'>('all');
  const [targetId, setTargetId] = useState(''); // グループIDまたは会員ID
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 送信処理
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // 宛先トピック（recipientId）の判定
    let finalRecipientId = '';
    if (recipientType === 'all') {
      finalRecipientId = 'all';
    } else if (recipientType === 'executive') {
      finalRecipientId = 'executive'; // 執行部専用トピック
    } else if (recipientType === 'group' || recipientType === 'user') {
      if (!targetId.trim()) {
        setStatusMessage({ type: 'error', text: recipientType === 'group' ? 'グループIDを入力・選択してください' : '対象の会員IDを入力・選択してください' });
        return;
      }
      finalRecipientId = targetId.trim();
    }

    if (!title.trim() || !body.trim()) {
      setStatusMessage({ type: 'error', text: '件名と本文を入力してください' });
      return;
    }

    setIsSending(true);

    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: CURRENT_ADMIN_ID,  // 🌟 送信者（ログイン中の管理者 member_id）
          recipientId: finalRecipientId, // 🌟 宛先（all / executive / group_id / member_id）
          title: title,
          body: body,
          url: '/events',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStatusMessage({ type: 'success', text: 'メッセージの送信とGoogle Sheetsへの保存が完了しました！' });
        // フォームのリセット
        setTitle('');
        setBody('');
        setTargetId('');
      } else {
        throw new Error(data.error || '送信に失敗しました');
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || '送信中にエラーが発生しました' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm max-w-4xl">
      <h2 className="text-xl font-bold mb-4">メッセージを作成・送信</h2>

      {statusMessage && (
        <div className={`p-3 mb-4 rounded ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 送信先ドロップダウン */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">送信先</label>
            <select
              value={recipientType}
              onChange={(e) => {
                setRecipientType(e.target.value as any);
                setTargetId(''); // タイプ変更時にクリア
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全会員</option>
              <option value="executive">執行部のみ</option>
              <option value="group">グループ選択...</option>
              <option value="user">個人指定...</option>
            </select>
          </div>

          {/* 件名入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">件名</label>
            <input
              type="text"
              placeholder="件名を入力してください"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* グループ選択 または 個人指定が選ばれた時の追加フィールド */}
        {recipientType === 'group' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">グループID（例: GRP_001）</label>
            <input
              type="text"
              placeholder="対象のグループIDを入力"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {recipientType === 'user' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">対象会員ID（例: 10001235）</label>
            <input
              type="text"
              placeholder="対象の member_id を入力"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* 本文入力 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">本文</label>
          <textarea
            rows={5}
            placeholder="メッセージ本文を入力してください..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        {/* ボタン領域 */}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            プレビュー
          </button>
          <button
            type="submit"
            disabled={isSending}
            className="px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
          >
            {isSending ? '送信中...' : '送信する'}
          </button>
        </div>
      </form>
    </div>
  );
}