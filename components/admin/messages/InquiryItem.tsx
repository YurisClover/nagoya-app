// 各メッセージカード（折りたたみ・スレッド表示・削除管理）

'use client';

// ★ useEffect を追加でインポートします
import React, { useState, useEffect } from 'react';
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
  currentUserId: string; // ★ 追加: ログイン中の管理者ID
  onToggle: () => void;
  onSendReply: (recipientId: string, replyTitle: string, replyText: string) => Promise<boolean>;
  onDelete?: (messageId: string, replyIds?: string[]) => Promise<void>;
  onMarkAsRead?: (messageId: string) => Promise<void>; // ★ 追加: 既読処理を親から渡せるようにする（オプショナル）
}

export default function InquiryItem({
  inquiry,
  isExpanded,
  currentUserId,
  onToggle,
  onSendReply,
  onDelete,
  onMarkAsRead, // ★ 追加
}: InquiryItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const hasThreadUnread = !inquiry.isRead || (inquiry.replies && inquiry.replies.some((r) => !r.isRead));

  // ==========================================
  // ★ 修正: 開いたまま新着メッセージが来た時の自動既読処理
  // ==========================================
  useEffect(() => {
    // カードが閉じている時は何もしない
    if (!isExpanded) return;

    // 1. 親メッセージが未読で、かつ自分が送信者ではないかチェック
    const isParentUnread = !inquiry.isRead && inquiry.senderId !== currentUserId;

    // 2. 返信履歴の中の「未読」かつ「自分以外が送信」したメッセージのIDをすべて抽出
    const unreadReplyIds = inquiry.replies
      ?.filter((r) => !r.isRead && r.senderId !== currentUserId)
      .map((r) => r.id) || [];

    const hasUnreadReplies = unreadReplyIds.length > 0;

    // 未読のものが含まれていれば既読処理を実行
    if (isParentUnread || hasUnreadReplies) {
      const handleRead = async () => {
        try {
          // 3. コメントアウトを外して、直接APIを叩く
          // ※API側（route.ts）の仕様に合わせて messageId と replyIds を送る
          const res = await fetch('/api/admin/inquiries/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              messageId: inquiry.id, // route.tsで必須チェックがあるため親IDは必ず送る
              replyIds: unreadReplyIds // 未読の返信IDの配列を送る
            }),
          });

          if (res.ok) {
            console.log('スプレッドシートの既読化に成功しました');
            
            // API成功後に親コンポーネントの処理（リストの再取得など）を呼ぶ
            if (onMarkAsRead) {
              await onMarkAsRead(inquiry.id);
            }
          } else {
            console.error('既読化APIエラー:', await res.text());
          }
        } catch (error) {
          console.error('自動既読処理に失敗しました:', error);
        }
      };

      handleRead();
    }
  }, [isExpanded, inquiry, currentUserId, onMarkAsRead]);
  // ==========================================

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このメッセージとスレッド内の返信をすべて削除してもよろしいですか？')) return;

    try {
      setIsDeleting(true);
      if (onDelete) {
        // 返信履歴のIDをすべて配列にする
        const replyIds = inquiry.replies?.map((r) => r.id) || [];
        // 親メッセージのIDと、子メッセージのID配列を両方渡す
        await onDelete(inquiry.id, replyIds);
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
        hasThreadUnread ? 'bg-[#eaf2fd] border-blue-200 shadow-sm' : 'bg-white border-slate-200'
      }`}
    >
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer hover:opacity-90 transition flex items-center justify-between"
      >
        <div className="flex items-center space-x-3.5 flex-1 min-w-0 mr-4">
          <div className="w-12 h-12 rounded-full bg-[#1b365d] text-white font-bold flex items-center justify-center text-lg flex-shrink-0 shadow-xs">
            {inquiry.userName ? inquiry.userName.charAt(0).toUpperCase() : '事'}
          </div>

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

        <div className="flex items-center space-x-3 flex-shrink-0">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
            {formatRelativeDateTime(inquiry.createdAt)}
          </span>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="メッセージを削除"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-5 pt-2 border-t border-slate-200/60 bg-white/50 space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap">
            <p className="text-xs text-slate-400 mb-1 font-semibold">【問い合わせ本文】</p>
            {inquiry.body}
          </div>

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
          {(() => {
            const ADMIN_ID = currentUserId;
            const opponentId = inquiry.senderId === ADMIN_ID ? inquiry.recipientId : inquiry.senderId;

            const isMyMessage = inquiry.senderId === ADMIN_ID;

            const targetUserName = isMyMessage
              ? ((inquiry as any).recipientName || 'お相手')
              : inquiry.userName;

            return (
              <InlineReplyForm
                userName={targetUserName}
                recipientId={opponentId}
                subject={inquiry.subject}
                onSendReply={async (_, replyTitle, replyText) =>
                  await onSendReply(opponentId, replyTitle, replyText)
                }
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}