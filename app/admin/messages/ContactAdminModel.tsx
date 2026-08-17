'use client';

import React, { useState } from 'react';

interface ContactAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ContactAdminModal({
  isOpen,
  onClose,
  onSuccess,
}: ContactAdminModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !body.trim()) {
      alert('件名と本文を入力してください。');
      return;
    }

    try {
      setIsSending(true);

      const res = await fetch('/api/send-notification', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
         recipient_id: 'admin', // 'admin' と指定すると、API側で role: admin & status: active な人を全自動抽出します
         title,
         body,
       }),
     });

      const data = await res.json();

      if (data.success) {
        alert('管理者へメッセージを送信しました。');
        setTitle('');
        setBody('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        alert(`送信失敗: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('送信処理中にエラーが発生しました。');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
          管理者へメッセージを送る
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">件名</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b365d]"
              placeholder="件名を入力してください"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">本文</label>
            <textarea
              rows={5}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b365d]"
              placeholder="お問い合わせ・メッセージ内容を入力してください..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              disabled={isSending}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-5 py-2 text-sm bg-[#1b365d] text-white font-bold rounded-lg hover:bg-[#152a48] transition disabled:opacity-50"
            >
              {isSending ? '送信中...' : '送信する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}