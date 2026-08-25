// 受信メッセージをまとめるコンポーネント

'use client';

import React, { useState } from 'react';
import InquiryItem, { ReceivedMessage, MessageStatus } from './InquiryItem';
import PagerControls from '@/components/PagerControls';

const ITEMS_PER_PAGE = 10;

// API のレスポンスに snake_case のフィールドが混在していた時期の名残を
// any キャストではなく optional な追加フィールドとして型で表現する。
type RawSheetFields = {
  delete_flag?: boolean | string;
  isDeleted?: boolean;
  created_at?: string;
};

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
  onStatusChange: (messageId: string, newStatus: MessageStatus) => Promise<void>;
  isAdmin?: boolean; // ★ 追加: 管理者フラグをオプショナルで受け取る
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
  isAdmin = false, // ★ 追加: デフォルトは false
}: InquiryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // メッセージのフィルタリングとソート
  const activeInquiries = [...inquiries]
    .filter((item) => {
      // API側の仕様に合わせて、複数のフラグ形式を許容する
      const raw = item as ReceivedMessage & RawSheetFields;
      const isDeleted =
        raw.delete_flag === true ||
        raw.delete_flag === 'true' ||
        raw.deleteFlag === true ||
        raw.deleteFlag === 'true' ||
        raw.isDeleted === true;

      return !isDeleted;
    })
    .sort((a, b) => {
      // 親メッセージと全返信の中から最も新しい日時を取得
      const getLatestTime = (item: ReceivedMessage & RawSheetFields) => {
        let latest = item.createdAt || item.created_at || '';
        if (item.replies && Array.isArray(item.replies)) {
          item.replies.forEach((reply) => {
            const replyTime =
              reply.createdAt || (reply as typeof reply & RawSheetFields).created_at;
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

  // ページング: 60秒ポーリングで件数が減った場合に currentPage が範囲外に
  // ならないよう、描画時にクランプする(effect で setState しない)。
  const pageCount = Math.ceil(activeInquiries.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(pageCount - 1, 0));
  const pagedInquiries = activeInquiries.slice(
    safePage * ITEMS_PER_PAGE,
    (safePage + 1) * ITEMS_PER_PAGE
  );

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
          {pagedInquiries.map((item) => (
            <InquiryItem
              key={item.id}
              inquiry={item}
              isExpanded={expandedId === item.id}
              currentUserId={currentUserId}
              onToggle={() => handleToggle(item)}
              onSendReply={onSendReply}
              onDelete={onDeleteMessage}
              onStatusChange={onStatusChange}
              isAdmin={isAdmin} // ★ 追加: InquiryItem へバケツリレー
            />
          ))}
        </div>
      )}

      <PagerControls pageCount={pageCount} currentPage={safePage} onPageChange={setCurrentPage} />
    </section>
  );
}