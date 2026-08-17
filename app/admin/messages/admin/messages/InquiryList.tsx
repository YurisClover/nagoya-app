// 受信メッセージをまとめるコンポーネント

'use client';

import React, { useState } from 'react';
import InquiryItem, { ReceivedMessage, MessageStatus } from './InquiryItem';

interface InquiryListProps {
  inquiries: ReceivedMessage[];
  isLoading: boolean;
  lastUpdated: string;
  unreadCountTotal: number;
  currentUserId: string;
  onMarkAsRead: (target: ReceivedMessage | string) => void;
  onSendReply: (
    parentMessageId: string,
    recipientId: string,
    replyTitle: string,
    replyText: string
  ) => Promise<boolean>;
  onDeleteMessage?: (messageId: string, replyIds?: string[]) => Promise<void>;
  // ★ 型を更新: unsupported を追加
  onStatusChange: (messageId: string, newStatus: MessageStatus) => Promise<void>;
}

export default function InquiryList({
  inquiries,
  isLoading,
  lastUpdated,
  unreadCountTotal,
  currentUserId,
  onMarkAsRead,
  onSendReply,
  onDeleteMessage,
  onStatusChange,
}: InquiryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // メッセージのフィルタリングとソート
  const activeInquiries = [...inquiries]
    .filter((item) => {
      // API側の仕様に合わせて、複数のフラグ形式を許容する
      const isDeleted =
        (item as any).delete_flag === true ||
        (item as any).delete_flag === 'true' ||
        item.deleteFlag === true ||
        item.deleteFlag === 'true' ||
        (item as any).isDeleted === true;

      return !isDeleted;
    })
    .sort((a, b) => {
      // 親メッセージと全返信の中から最も新しい日時を取得
      const getLatestTime = (item: ReceivedMessage) => {
        let latest = item.createdAt || (item as any).created_at || '';
        if (item.replies && Array.isArray(item.replies)) {
          item.replies.forEach((reply) => {
            const replyTime = reply.createdAt || (reply as any).created_at;
            if (replyTime && replyTime > latest) {
              latest = replyTime;
            }
          });
        }
        return latest;
      };

      const timeA = getLatestTime(a);
      const timeB = getLatestTime(b);

      // 新しい順（降順）にソート
      return timeB.localeCompare(timeA);
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
      ) : activeInquiries.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">管理者宛てのメッセージはありません</p>
      ) : (
        <div className="space-y-4">
          {activeInquiries.map((item) => (
            <InquiryItem
              key={item.id}
              inquiry={item}
              isExpanded={expandedId === item.id}
              currentUserId={currentUserId}
              onToggle={() => handleToggle(item)}
              onSendReply={onSendReply}
              onDelete={onDeleteMessage}
              onMarkAsRead={async (messageId) => {
                onMarkAsRead(messageId);
              }}
              // ★ ステータス変更関数をバケツリレー
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}