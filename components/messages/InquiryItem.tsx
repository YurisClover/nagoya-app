/**
 * One message thread card, shared by the member page and the admin
 * inquiry list. Shows subject/sender/relative time/unread state,
 * expands to the reply history and an InlineReplyForm.
 * Exports ReceivedMessage / MessageStatus: the shared display contract
 * both sides normalize their API data into.
 */
'use client';

import React, { useState } from 'react';
import { formatRelativeDateTime } from '@/lib/datetime';
import InlineReplyForm from './InlineReplyForm';

export type ReplyMessage = {
  id: string;
  senderId: string;
  recipientId?: string;
  userName: string;
  senderName?: string;
  recipientName?: string;
  memberId?: string;
  subject: string;
  body: string;
  isRead?: boolean;
  createdAt: string;
};

export type MessageStatus = 'unsupported' | 'pending' | 'closed';

export type ReceivedMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  userName: string;
  recipientName?: string;
  memberId?: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  status: MessageStatus;
  lastStatusUpdatedBy?: string | null;
  deleteFlag?: boolean | string;
  replies?: ReplyMessage[];
};

interface InquiryItemProps {
  inquiry: ReceivedMessage;
  isExpanded: boolean;
  currentUserId: string;
  onToggle: () => void;
  onSendReply: (parentMessageId: string, recipientId: string, replyTitle: string, replyText: string) => Promise<boolean>;
  onDelete?: (messageId: string, replyIds?: string[]) => Promise<void>;
  // ★変更: 一般側では渡さなくて済むようにオプショナル(?)に変更
  onStatusChange?: (messageId: string, newStatus: MessageStatus) => Promise<void>;
  // ★追加: 管理者かどうかを判定するフラグ（デフォルトは false）
  isAdmin?: boolean; 
}

export default function InquiryItem({
  inquiry,
  isExpanded,
  currentUserId,
  onToggle,
  onSendReply,
  onDelete,
  onStatusChange,
  isAdmin = false, // ★追加: デフォルトは一般ユーザー（false）とする
}: InquiryItemProps) {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const statusConfig: Record<MessageStatus, { label: string; className: string }> = {
    unsupported: { label: '未対応', className: 'bg-red-100 text-red-700' },
    pending: { label: '対応中', className: 'bg-yellow-100 text-yellow-700' },
    closed: { label: '対応完了', className: 'bg-green-100 text-green-700' },
  };

  const currentStatus: MessageStatus = inquiry.status || 'unsupported';
  const config = statusConfig[currentStatus];

  const handleStatusChange = async (newStatus: MessageStatus): Promise<void> => {
    if (!onStatusChange) return;
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(inquiry.id, newStatus);
    } catch (err) {
      console.error('ステータス変更エラー:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isParentUnread: boolean = !inquiry.isRead && String(inquiry.senderId).trim() !== String(currentUserId).trim();
  const hasUnreadReplies: boolean = inquiry.replies
    ? inquiry.replies.some((r: ReplyMessage) => !r.isRead && String(r.senderId).trim() !== String(currentUserId).trim())
    : false;
  const hasThreadUnread: boolean = isParentUnread || hasUnreadReplies;

  // 既読化は親コンポーネント側で toggle 時に行う(InquiryList.handleToggle /
  // MessagesClient.handleToggle)。共有コンポーネントのここでは行わない。

  const handleDelete = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!confirm('このメッセージとスレッド内の返信をすべて削除してもよろしいですか？')) return;
    try {
      setIsDeleting(true);
      if (onDelete) {
        const replyIds: string[] = inquiry.replies?.map((r: ReplyMessage) => r.id) || [];
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
            {inquiry.userName ? inquiry.userName.charAt(0).toUpperCase() : 'U'}
          </div>

          <div className="flex-1 min-w-0">
            {/* 会員IDは一覧の行には出さない — ID側が shrink-0 のため
                狭い画面で名前が潰れて読めなくなる。admin には展開時に表示する */}
            <p className="font-bold text-base text-slate-900 leading-tight truncate">
              {inquiry.userName}
            </p>
            <p className={`text-sm mt-0.5 truncate ${hasThreadUnread ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
              {inquiry.subject}
            </p>
          </div>
        </div>

        {/* 右側は縦2段に積む: 上段=バッジ+削除ボタン / 下段=日時。
            横1列に3つ並べると幅が「合計」になり名前を圧迫するが、
            縦積みなら幅は「一番広い1つ分」で済む */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1">
            {/* ステータス変更者IDは admin のみ・広い画面のみ */}
            {isAdmin && inquiry.lastStatusUpdatedBy && (
              <span className="hidden sm:inline text-[11px] text-slate-400">
                ({inquiry.lastStatusUpdatedBy})
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${config.className}`}>
              {config.label}
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

          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
            {formatRelativeDateTime(inquiry.createdAt)}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-5 pt-2 border-t border-slate-200/60 bg-white/50 space-y-4">

          {/* 会員IDは admin にだけ、展開時に表示(一覧の行を圧迫しない位置) */}
          {isAdmin && inquiry.memberId && (
            <p className="pt-2 text-xs text-slate-500">
              会員ID: <span className="font-mono font-medium text-slate-700">{inquiry.memberId}</span>
            </p>
          )}

          {/* ★変更: isAdminがtrueの時のみステータス変更ボタンを表示 */}
          {isAdmin && (
            <div className="flex items-center space-x-2 pt-2">
              <span className="text-xs font-bold text-slate-500">ステータス変更:</span>
              {(['unsupported', 'pending', 'closed'] as MessageStatus[]).map((s) => (
                <button
                  key={s}
                  disabled={isUpdatingStatus || currentStatus === s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition ${
                    currentStatus === s 
                      ? 'bg-slate-800 text-white border-slate-800' 
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {statusConfig[s].label}
                </button>
              ))}
            </div>
          )}

          <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap">
            <p className="text-xs text-slate-400 mb-1 font-semibold">【問い合わせ本文】</p>
            {inquiry.body}
          </div>

          {inquiry.replies && inquiry.replies.length > 0 && (
            <div className="pl-4 space-y-3 border-l-2 border-[#1b365d]">
              <p className="text-xs font-bold text-slate-600">返信履歴</p>
              {inquiry.replies.map((reply: ReplyMessage) => (
                <div key={reply.id} className="bg-white border border-slate-200 p-3 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">
                      {reply.senderName || reply.userName || reply.senderId} {isAdmin && reply.memberId ? `(${reply.memberId})` : ''}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatRelativeDateTime(reply.createdAt)}</span>
                  </div>
                  <p className="text-slate-800 whitespace-pre-wrap mt-1">{reply.body}</p>
                </div>
              ))}
            </div>
          )}

          {currentStatus === 'closed' ? (
            <div className="p-4 bg-slate-100 rounded-lg text-center text-sm text-slate-500">
              この問い合わせは「対応完了」に設定されているため、返信できません。
            </div>
          ) : (
            (() => {
              const isMyMessage = String(inquiry.senderId).trim() === String(currentUserId).trim();
              const opponentId = isMyMessage ? inquiry.recipientId : inquiry.senderId;
              const targetUserName = isMyMessage ? (inquiry.recipientName || '宛先') : (inquiry.userName || '差出人');
              return (
                <InlineReplyForm
                  parentMessageId={inquiry.id}
                  userName={targetUserName}
                  recipientId={opponentId}
                  subject={inquiry.subject}
                  onSendReply={async (pId, rId, replyTitle, replyText) =>
                    await onSendReply(pId, rId, replyTitle, replyText)
                  }
                />
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}