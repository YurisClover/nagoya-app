'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MessageForm from '@/components/messages/MessageForm';
import InquiryList from '@/components/messages/InquiryList';
import { ReceivedMessage, MessageStatus } from '@/components/messages/InquiryItem';

type Group = {
  group_id: string;
  group_name: string;
};

type AdminMessagesClientProps = {
  currentUserId: string;
  /** /admin/groups の「送信」リンクから遷移した時に、グループを事前選択する */
  initialGroupId?: string;
};

export default function AdminMessagesClient({
  currentUserId,
  initialGroupId = '',
}: AdminMessagesClientProps) {

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
        const res = await fetch('/api/groups', { cache: 'no-store' });
        const data = (await res.json()) as { success: boolean; groups?: Array<{ group_id?: string; id?: string; group_name?: string; name?: string }> };
        if (data.success && Array.isArray(data.groups)) {
          setGroups(
            data.groups.map((g) => ({
              group_id: g.group_id || g.id || '',
              group_name: g.group_name || g.name || '名称未設定グループ',
            }))
          );
        }
      } catch (err: unknown) {
        console.error('グループ一覧の取得に失敗しました:', err);
      }
    }
    fetchGroups();
  }, []);

  const fetchInquiries = useCallback(
    async (isSilent = false) => {
      try {
        // cache: 'no-store' がキャッシュを無効化するので、キャッシュバスター(?t=)は不要
        const res = await fetch('/api/admin/inquiries', { cache: 'no-store' });
        const data = (await res.json()) as { success: boolean; inquiries?: ReceivedMessage[] };
        if (data.success && Array.isArray(data.inquiries)) {
          const filteredInquiries = data.inquiries.filter((item) => {
            const isDeleted =
              item.deleteFlag === true ||
              item.deleteFlag === 'true' ||
              (item as unknown as { deleteFlag?: boolean | string }).deleteFlag === true ||
              (item as unknown as { deleteFlag?: boolean | string }).deleteFlag === 'true' ||
              (item as unknown as { isDeleted?: boolean }).isDeleted === true;
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
          filteredInquiries.forEach((item) => {
            if (!item.isRead) unreadTotal++;
            if (item.replies) {
              item.replies.forEach((r) => {
                if (!r.isRead) unreadTotal++;
              });
            }
          });
          notifyUnreadCountChange(unreadTotal);
        }
      } catch (err: unknown) {
        console.error('受信メッセージの取得に失敗しました:', err);
      } finally {
        if (!isSilent) setIsLoadingInquiries(false);
      }
    },
    [notifyUnreadCountChange]
  );

  useEffect(() => {
    // ルール(react-hooks/set-state-in-effect)対応:
    // effect 本体から state を更新する関数を「同期的に」呼ぶと警告されるため、
    // 初回ロードも setInterval と同じくコールバック経由(setTimeout 0)で呼ぶ。
    const initialId = setTimeout(() => fetchInquiries(false), 0);
    const intervalId = setInterval(() => {
      fetchInquiries(true);
    }, 60000);
    return () => {
      clearTimeout(initialId);
      clearInterval(intervalId);
    };
  }, [fetchInquiries]);

  const handleStatusChange = async (messageId: string, newStatus: MessageStatus): Promise<void> => {
    try {
      const res = await fetch('/api/admin/inquiries/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, status: newStatus }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        await fetchInquiries(true);
      } else {
        alert('ステータスの更新に失敗しました: ' + (data.error ?? '不明なエラー'));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(errorMsg);
      alert('通信エラーが発生しました');
    }
  };

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
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: inquiry.id,
          replyIds: replyIds,
        }),
      });
    } catch (err: unknown) {
      console.error('既読更新エラー:', err);
    }
  };

  const handleSendReply = async (
    parentMessageId: string,
    recipientId: string,
    replyTitle: string,
    replyText: string
  ): Promise<boolean> => {
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

      const data = (await res.json()) as { success: boolean; error?: string };

      if (res.ok && data.success) {
        alert('送信が完了しました');
        await fetchInquiries(true);
        return true;
      } else {
        alert(`送信エラー: ${data.error || '返信の送信に失敗しました'}`);
        return false;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`通信エラー: ${errorMsg}`);
      return false;
    }
  };

  const handleDeleteMessage = async (messageId: string, replyIds: string[] = []) => {
    try {
      const res = await fetch('/api/messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, replyIds }),
      });

      const data = (await res.json()) as { success: boolean; error?: string };
      if (res.ok && data.success) {
        alert('メッセージを削除しました');
        await fetchInquiries(true);
      } else {
        alert(`削除失敗: ${data.error || 'メッセージの削除に失敗しました'}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('削除エラー:', err);
      alert(`通信エラー: ${errorMsg}`);
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
    <div className="space-y-6 sm:space-y-8">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900">メッセージ管理</h2>

      {/* 送信フォーム */}
      <MessageForm groups={groups} initialGroupId={initialGroupId} onSuccess={() => fetchInquiries(true)} />

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
        onStatusChange={handleStatusChange}
        isAdmin={true}
      />
    </div>
  );
}
