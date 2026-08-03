//受信メッセージ一覧をまとめるコンポーネント

'use client';

import React, { useState } from 'react';
import InquiryItem, { ReceivedMessage } from './InquiryItem';

interface InquiryListProps {
  inquiries: ReceivedMessage[];
  isLoading: boolean;
  lastUpdated: string;
  unreadCountTotal: number;
  onMarkAsRead: (inquiry: ReceivedMessage) => void;
  onSendReply: (recipientId: string, replyTitle: string, replyText: string) => Promise<boolean>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
}

export default function InquiryList({
  inquiries,
  isLoading,
  lastUpdated,
  unreadCountTotal,
  onMarkAsRead,
  onSendReply,
  onDeleteMessage,
}: InquiryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // delete_flag (または isDeleted / deleteFlag) が true のものを画面表示から除外
  const activeInquiries = inquiries.filter((item: any) => {
    const isDeleted =
      item.delete_flag === true ||
      item.delete_flag === 'true' ||
      item.deleteFlag === true ||
      item.deleteFlag === 'true' ||
      item.isDeleted === true;

    return !isDeleted;
  });

  const handleToggle = (inquiry: ReceivedMessage) => {
    const isOpening = expandedId !== inquiry.id;
    setExpandedId(isOpening ? inquiry.id : null);

    if (isOpening) {
      const hasUnread = !inquiry.isRead || (inquiry.replies && inquiry.replies.some((r) => !r.isRead));
      if (hasUnread) {
        onMarkAsRead(inquiry);
      }
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-base font-bold text-slate-800">受信メッセージ（問い合わせ）</h3>
          {unreadCountTotal > 0 && (
            <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              未読 {unreadCountTotal}件
            </span>
          )}
        </div>
        {lastUpdated && <span className="text-xs text-slate-400">最終更新: {lastUpdated}</span>}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500 py-4">読み込み中...</p>
      ) : activeInquiries.length === 0 ? ( // ★ inquiries から activeInquiries に変更
        <p className="text-sm text-slate-500 py-4">管理者宛てのメッセージはありません</p>
      ) : (
        <div className="space-y-4">
          {activeInquiries.map((item) => ( // ★ inquiries から activeInquiries に変更
            <InquiryItem
              key={item.id}
              inquiry={item}
              isExpanded={expandedId === item.id}
              onToggle={() => handleToggle(item)}
              onSendReply={onSendReply}
              onDelete={onDeleteMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}