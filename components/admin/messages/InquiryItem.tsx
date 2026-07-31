//各メッセージカード（折りたたみ・スレッド表示・既読処理の管理）

'use client';

import React from 'react';
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
}

export default function InquiryItem({ inquiry, isExpanded, onToggle, onSendReply }: InquiryItemProps) {
  const hasThreadUnread = !inquiry.isRead || (inquiry.replies && inquiry.replies.some((r) => !r.isRead));

  return (
    <div
      className={`border rounded-xl transition overflow-hidden ${
        hasThreadUnread ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'
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