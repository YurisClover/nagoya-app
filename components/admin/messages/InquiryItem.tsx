// 各メッセージカード（折りたたみ・スレッド表示・削除管理）

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
          ? 'bg-[#eaf2fd] border-blue-200 shadow-sm' // 未読時の薄青背景
          : 'bg-white border-slate-200'              // 既読時の白背景
      }`}
    >
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer hover:opacity-90 transition flex items-center justify-between"
      >
        {/* 左側：アイコン + 差出人情報・件名 */}
        <div className="flex items-center space-x-3.5 flex-1 min-w-0 mr-4">
          {/* アイコン */}
          <div className="w-12 h-12 rounded-full bg-[#1b365d] text-white font-bold flex items-center justify-center text-lg flex-shrink-0 shadow-xs">
            {inquiry.userName ? inquiry.userName.charAt(0).toUpperCase() : '事'}
          </div>

          {/* メッセージ概要 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base text-slate-900 leading-tight truncate">
                {inquiry.userName}
              </span>
              {inquiry.memberId && (
                <span className="text-xs text-slate-500 font-medium shrink-0">
                  ({inquiry.memberId})
                </span>
              )}
            </div>

            <p className={`text-sm mt-0.5 truncate ${hasThreadUnread ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
              {inquiry.subject}
            </p>
          </div>
        </div>

        {/* 右側：送信時刻 + 削除ボタン */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          {/* 送信時刻 */}
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
            {formatRelativeDateTime(inquiry.createdAt)}
          </span>

          {/* 削除ボタン */}
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

      {/* アコーディオン開閉時の詳細・スレッド表示 */}
      {isExpanded && (
        <div className="px-4 pb-5 pt-2 border-t border-slate-200/60 bg-white/50 space-y-4">
          {/* 問い合わせ本文 */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap">
            <p className="text-xs text-slate-400 mb-1 font-semibold">【問い合わせ本文】</p>
            {inquiry.body}
          </div>

          {/* 返信履歴 */}
          {inquiry.replies && inquiry.replies.length > 0 && (
            <div className="pl-4 space-y-3 border-l-2 border-[#1b365d]">
              <p className="text-xs font-bold text-slate-600">返信履歴</p>
              {inquiry.replies.map((reply) => (
                <div key={reply.id} className="bg-white border border-slate-200 p-3 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">
                      {reply.userName || reply.senderId} {reply.memberId ? `(${reply.memberId})` : ''}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeDateTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-slate-800 whitespace-pre-wrap mt-1">{reply.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* インライン返信フォーム */}
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