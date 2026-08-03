// 各メッセージカード（折りたたみ・スレッド表示・既読処理・削除管理）

'use client';

import React, { useState } from 'react';
import { formatRelativeDateTime } from '@/lib/datetime';
import InlineReplyForm from './InlineReplyForm';

export type ReplyMessage = {
  id: string;
  senderId: string;
  userName: string;
  memberId?: string;
  subject: string;
  body: string;
  isRead?: boolean;
  createdAt: string;
};

export type ReceivedMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  userName: string;
  memberId?: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  replies?: ReplyMessage[];
};

interface InquiryItemProps {
  inquiry: ReceivedMessage;
  isExpanded: boolean;
  onToggle: () => void;
  onSendReply: (recipientId: string, replyTitle: string, replyText: string) => Promise<boolean>;
  onDelete?: (messageId: string) => Promise<void>;
}

export default function InquiryItem({
  inquiry,
  isExpanded,
  onToggle,
  onSendReply,
  onDelete,
}: InquiryItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const hasThreadUnread = !inquiry.isRead || (inquiry.replies && inquiry.replies.some((r) => !r.isRead));

  // 削除処理のハンドラー
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // アコーディオン開閉を防ぐ

    if (!confirm('このメッセージを削除してもよろしいですか？')) return;

    try {
      setIsDeleting(true);
      if (onDelete) {
        await onDelete(inquiry.id);
      } else {
        // デフォルトの削除 API 呼び出し
        const res = await fetch('/api/messages/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: inquiry.id }),
        });
        const data = await res.json();
        if (data.success) {
          alert('削除が完了しました');
          window.location.reload();
        } else {
          alert(`削除失敗: ${data.error}`);
        }
      }
    } catch (err) {
      console.error(err);
      alert('削除処理中にエラーが発生しました');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`border rounded-xl transition overflow-hidden ${
        hasThreadUnread
          ? 'bg-blue-50/60 border-2 border-blue-400 shadow-sm' // ★ 黄色から「淡い青背景＋青枠」に変更
          : 'bg-white border-slate-200'
      }`}
    >
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer hover:bg-slate-50/80 transition flex items-start justify-between"
      >
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#1b365d] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
            {inquiry.userName ? inquiry.userName.charAt(0) : 'U'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-900">{inquiry.userName}</span>
              <span className="text-xs text-slate-500">({inquiry.memberId || inquiry.senderId})</span>
              {hasThreadUnread && (
                /* ★ 未読バッジは「赤色」を保持 */
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                  未読あり
                </span>
              )}
            </div>
            <p className={`text-sm mt-0.5 ${hasThreadUnread ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
              {inquiry.subject}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400">{formatRelativeDateTime(inquiry.createdAt)}</span>

          {/* 削除ボタン（ゴミ箱アイコン） */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="メッセージを削除"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-5 pt-2 border-t border-slate-200 bg-slate-50/50 space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap">
            <p className="text-xs text-slate-400 mb-1 font-semibold">【問い合わせ本文】</p>
            {inquiry.body}
          </div>

          {inquiry.replies && inquiry.replies.length > 0 && (
            <div className="pl-6 space-y-3 border-l-2 border-blue-400">
              <p className="text-xs font-bold text-slate-600">返信履歴</p>
              {inquiry.replies.map((reply) => (
                <div key={reply.id} className="bg-blue-50/70 border border-blue-100 p-3 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-blue-900">
                      {reply.userName} ({reply.memberId || reply.senderId})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeDateTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-slate-800 whitespace-pre-wrap">{reply.body}</p>
                </div>
              ))}
            </div>
          )}

          <InlineReplyForm
            userName={inquiry.userName}
            senderId={inquiry.senderId}
            subject={inquiry.subject}
            onSendReply={(replyTitle, replyText) =>
              onSendReply(inquiry.senderId, replyTitle, replyText)
            }
          />
        </div>
      )}
    </div>
  );
}