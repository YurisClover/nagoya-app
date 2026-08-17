'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MessageForm from '@/app/admin/messages/admin/messages/MessageForm';
import InquiryList from '@/app/admin/messages/admin/messages/InquiryList';
import { ReceivedMessage } from '@/app/admin/messages/admin/messages/InquiryItem';
import { SessionProvider, useSession } from 'next-auth/react';

type Group = {
  group_id: string;
  group_name: string;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 中身のコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AdminMessageContent() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.member_id || session?.user?.id || '';

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
          const filteredInquiries = data.inquiries.filter((item: any) => {
            const isDeleted =
              item.delete_flag === true ||
              item.delete_flag === 'true' ||
              item.deleteFlag === true ||
              item.deleteFlag === 'true' ||
              item.isDeleted === true;
            return !isDeleted;
          });

          // ★ タイムスタンプ（数値）に変換して新しい順（降順）にソート
          filteredInquiries.sort((a: any, b: any) => {
            const getLatestTime = (item: any) => {
              let latest = item.createdAt || item.created_at || '';
              if (item.replies && Array.isArray(item.replies)) {
                item.replies.forEach((reply: any) => {
                  const replyTime = reply.createdAt || reply.created_at || '';
                  if (replyTime > latest) {
                    latest = replyTime;
                  }
                });
              }
              return latest ? new Date(latest).getTime() : 0;
            };

            const timeA = getLatestTime(a);
            const timeB = getLatestTime(b);

            return timeB - timeA;
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

  // 既読更新処理
  const handleMarkAsRead = async (target: ReceivedMessage | string) => {
    const inquiry = typeof target === 'string'
      ? inquiries.find((item) => item.id === target)
      : target;

    if (!inquiry) return;

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

  // 返信送信処理
  const handleSendReply = async (
    parentMessageId: string,
    recipientId: string,
    replyTitle: string,
    replyText: string
  ) => {
    try {
      const res = await fetch('/api/admin/inquiries/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentMessageId,
          recipientId,
          subject: replyTitle,
          body: replyText,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert('送信が完了しました');
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

  // メッセージ削除処理
  const handleDeleteMessage = async (messageId: string, replyIds: string[] = []) => {
    try {
      const res = await fetch('/api/messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, replyIds }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('メッセージを削除しました');
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
        currentUserId={currentUserId}
        onMarkAsRead={handleMarkAsRead}
        onSendReply={handleSendReply}
        onDeleteMessage={handleDeleteMessage}
      />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. ページのガワ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function AdminMessagePage() {
  return (
    <SessionProvider>
      <AdminMessageContent />
    </SessionProvider>
  );
}