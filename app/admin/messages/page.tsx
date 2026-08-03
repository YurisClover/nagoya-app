'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MessageForm from '@/components/admin/messages/MessageForm';
import InquiryList from '@/components/admin/messages/InquiryList';
import { ReceivedMessage } from '@/components/admin/messages/InquiryItem';

type Group = {
  group_id: string;
  group_name: string;
};

export default function AdminMessagePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [inquiries, setInquiries] = useState<ReceivedMessage[]>([]);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const notifyUnreadCountChange = useCallback((count: number) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('unread-count-updated', { detail: { unreadCount: count } })
      );
    }
  }, []);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups');
        const data = await res.json();
        if (data.success && Array.isArray(data.groups)) {
          setGroups(
            data.groups.map((g: any) => ({
              group_id: g.group_id || g.id || '',
              group_name: g.group_name || g.name || '名称未設定グループ',
            }))
          );
        }
      } catch (err) {
        console.error('グループ一覧の取得に失敗しました:', err);
      }
    }
    fetchGroups();
  }, []);

  const fetchInquiries = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoadingInquiries(true);
      try {
        const res = await fetch('/api/admin/inquiries');
        const data = await res.json();
        if (data.success && Array.isArray(data.inquiries)) {
          
          // ★ delete_flag が true / 'true' のデータを取り除くフィルターを追加
          const filteredInquiries = data.inquiries.filter((item: any) => {
            const isDeleted =
              item.delete_flag === true ||
              item.delete_flag === 'true' ||
              item.deleteFlag === true ||
              item.deleteFlag === 'true' ||
              item.isDeleted === true;
            return !isDeleted;
          });

          setInquiries(filteredInquiries);
          setLastUpdated(
            new Date().toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );

          let unreadTotal = 0;
          filteredInquiries.forEach((item: ReceivedMessage) => {
            if (!item.isRead) unreadTotal++;
            if (item.replies) {
              item.replies.forEach((r) => {
                if (!r.isRead) unreadTotal++;
              });
            }
          });
          notifyUnreadCountChange(unreadTotal);
        }
      } catch (err) {
        console.error('受信メッセージの取得に失敗しました:', err);
      } finally {
        if (!isSilent) setIsLoadingInquiries(false);
      }
    },
    [notifyUnreadCountChange]
  );

  useEffect(() => {
    fetchInquiries(false);
    const intervalId = setInterval(() => {
      fetchInquiries(true);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [fetchInquiries]);

  const handleMarkAsRead = async (inquiry: ReceivedMessage) => {
    const replyIds = inquiry.replies ? inquiry.replies.map((r) => r.id).filter(Boolean) : [];

    const newInquiries = inquiries.map((item) => {
      if (item.id === inquiry.id) {
        return {
          ...item,
          isRead: true,
          replies: item.replies?.map((r) => ({ ...r, isRead: true })),
        };
      }
      return item;
    });

    setInquiries(newInquiries);

    let remainingUnread = 0;
    newInquiries.forEach((item) => {
      if (!item.isRead) remainingUnread++;
      if (item.replies) {
        item.replies.forEach((r) => {
          if (!r.isRead) remainingUnread++;
        });
      }
    });

    notifyUnreadCountChange(remainingUnread);

    try {
      await fetch('/api/admin/inquiries/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: inquiry.id,
          replyIds: replyIds,
        }),
      });
    } catch (err) {
      console.error('既読更新エラー:', err);
    }
  };

  const handleSendReply = async (recipientId: string, replyTitle: string, replyText: string) => {
    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: recipientId,
          title: replyTitle,
          body: replyText,
          url: '/messages',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await fetchInquiries(true);
        return true;
      } else {
        alert(`送信エラー: ${data.error || '返信の送信に失敗しました'}`);
        return false;
      }
    } catch (err: any) {
      alert(`通信エラー: ${err.message}`);
      return false;
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch('/api/messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('メッセージを削除しました'); // ★ 追加: 削除完了アラートメッセージ
        await fetchInquiries(true);
      } else {
        alert(`削除失敗: ${data.error || 'メッセージの削除に失敗しました'}`);
      }
    } catch (err: any) {
      console.error('削除エラー:', err);
      alert(`通信エラー: ${err.message}`);
    }
  };

  let unreadCountTotal = 0;
  inquiries.forEach((item) => {
    if (!item.isRead) unreadCountTotal++;
    if (item.replies) {
      item.replies.forEach((r) => {
        if (!r.isRead) unreadCountTotal++;
      });
    }
  });

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <h2 className="text-2xl font-bold text-slate-900">メッセージ管理</h2>

      {/* 送信フォーム */}
      <MessageForm groups={groups} onSuccess={() => fetchInquiries(true)} />

      {/* 受信一覧 */}
      <InquiryList
        inquiries={inquiries}
        isLoading={isLoadingInquiries}
        lastUpdated={lastUpdated}
        unreadCountTotal={unreadCountTotal}
        onMarkAsRead={handleMarkAsRead}
        onSendReply={handleSendReply}
        onDeleteMessage={handleDeleteMessage}
      />
    </div>
  );
}