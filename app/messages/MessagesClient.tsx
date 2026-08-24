'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ContactAdminModal from '@/components/messages/ContactAdminModel';
import InquiryItem, { ReceivedMessage, MessageStatus } from '@/components/messages/InquiryItem';

// /api/messages のレスポンス形。API側は snake_case で返すが、
// 過去の実装が camelCase を返していた時期もあるため両方 optional で受ける。
type ApiReply = {
  reply_id?: string;
  id?: string;
  sender_id?: string;
  senderId?: string;
  recipient_id?: string;
  recipientId?: string;
  sender_name?: string;
  userName?: string;
  recipient_name?: string;
  recipientName?: string;
  member_id?: string;
  memberId?: string;
  title?: string;
  subject?: string;
  body?: string;
  is_read?: boolean;
  isRead?: boolean;
  created_at?: string;
  createdAt?: string;
};

type ApiMessage = ApiReply & {
  message_id?: string;
  status?: string;
  last_status_updated_by?: string;
  lastStatusUpdatedBy?: string;
  replies?: ApiReply[];
};

interface MessagesClientProps {
  currentUserId: string;
}

export default function MessagesClient({ currentUserId }: MessagesClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messages, setMessages] = useState<ReceivedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchMessages = useCallback(async (isBackground = false) => {
    try {
      const res = await fetch('/api/messages');
      const data = (await res.json()) as { success: boolean; messages?: ApiMessage[] };

      if (data.success && Array.isArray(data.messages)) {
        const formattedMessages: ReceivedMessage[] = data.messages.map((item: ApiMessage, idx: number) => {
          const senderId = item.senderId || item.sender_id || '';
          const recipientName = item.recipientName || item.recipient_name || '事務局';

          // 自分が送信者の場合は宛先（事務局）、それ以外（管理者からの受信など）は「事務局」にする
          const isMyMessage = String(senderId).trim() === String(currentUserId).trim();

          // status は API からは string で来るため union 型に絞り込む
          const rawStatus = (item.status || '').toLowerCase();
          const status: MessageStatus =
            rawStatus === 'pending' || rawStatus === 'closed' ? rawStatus : 'unsupported';
          const displayUserName = isMyMessage ? recipientName : '事務局';

          return {
            id: String(item.id || item.message_id || `msg-${idx}`),
            senderId: senderId,
            recipientId: item.recipientId || item.recipient_id || '',
            userName: displayUserName, // 宛先または「事務局」を表示
            recipientName: recipientName,
            memberId: item.memberId || item.member_id || '',
            subject: item.subject || item.title || '(件名なし)',
            body: item.body || '',
            isRead: Boolean(item.isRead ?? item.is_read),
            createdAt: item.createdAt || item.created_at || new Date().toISOString(),
            status,
            lastStatusUpdatedBy: item.lastStatusUpdatedBy || item.last_status_updated_by || '',
            replies: (item.replies || []).map((r: ApiReply, rIdx: number) => {
              const rSenderId = String(r.senderId || r.sender_id || '').trim();
              const isMyReply = rSenderId === String(currentUserId).trim();

              return {
                id: String(r.id || r.reply_id || `reply-${idx}-${rIdx}`),
                senderId: rSenderId,
                recipientId: r.recipientId || r.recipient_id || '',
                // 自分が送った返信でなければ「事務局」にする
                userName: isMyReply ? (r.userName || r.sender_name || '自分') : '事務局',
                recipientName: r.recipientName || r.recipient_name || '',
                memberId: r.memberId || r.member_id || '',
                subject: r.subject || r.title || '',
                body: r.body || '',
                isRead: Boolean(r.isRead ?? r.is_read),
                createdAt: r.createdAt || r.created_at || '',
              };
            }),
          };
        });

        setMessages(formattedMessages);
      }
    } catch (err) {
      console.error('メッセージ取得エラー:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    // ルール(react-hooks/set-state-in-effect)対応:
    // 初回ロードも setInterval と同じくコールバック経由(setTimeout 0)で呼ぶ。
    const initialId = setTimeout(() => fetchMessages(false), 0);

    const intervalId = setInterval(() => {
      fetchMessages(true);
    }, 60000);

    return () => {
      clearTimeout(initialId);
      clearInterval(intervalId);
    };
  }, [fetchMessages]);

  const handleToggle = async (msg: ReceivedMessage) => {
    const isTargetExpanded = expandedId === msg.id;
    const nextExpandedId = isTargetExpanded ? null : msg.id;
    setExpandedId(nextExpandedId);

    const hasUnread = !msg.isRead || msg.replies?.some((r) => !r.isRead);
    if (!isTargetExpanded && hasUnread) {
      try {
        const replyIds = msg.replies?.map((r) => r.id) || [];
        await fetch('/api/messages/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: msg.id,
            replyIds: replyIds,
          }),
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  isRead: true,
                  replies: m.replies?.map((r) => ({ ...r, isRead: true })),
                }
              : m
          )
        );
      } catch (err) {
        console.error('既読処理エラー:', err);
      }
    }
  };

  const handleSendReply = async (
    parentMessageId: string,
    recipientId: string,
    replyTitle: string,
    replyText: string
  ): Promise<boolean> => {
    try {
      const targetParentId = parentMessageId || expandedId || undefined;

      const res = await fetch('/api/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentMessageId: targetParentId,
          recipientId,
          title: replyTitle,
          body: replyText,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('返信を送信しました');
        fetchMessages(true);
        return true;
      } else {
        alert(`送信失敗: ${data.error}`);
        return false;
      }
    } catch (err) {
      console.error('返信送信エラー:', err);
      alert('返信処理中にエラーが発生しました');
      return false;
    }
  };

  const handleDelete = async (messageId: string) => {
    const res = await fetch('/api/messages/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });
    const data = await res.json();
    if (data.success) {
      alert('削除が完了しました');
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } else {
      alert(`削除失敗: ${data.error}`);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4 font-sans text-slate-800">
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full bg-[#1b365d] text-white font-bold py-3.5 px-4 rounded-xl shadow-sm hover:bg-[#152a48] transition text-base tracking-wide"
      >
        管理者へメッセージを送る
      </button>

      <ContactAdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchMessages(true);
        }}
      />

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 pt-2 pb-1">受信トレイ</h2>

        {loading ? (
          <div className="text-center py-8 text-slate-400">読み込み中...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            受信したメッセージはありません
          </div>
        ) : (
          <div className="space-y-3">
           {[...messages]
            .sort((a, b) => {
              const getLatestTime = (item: ReceivedMessage) => {
                let latest = item.createdAt || '';
                if (item.replies && Array.isArray(item.replies)) {
                  item.replies.forEach((reply) => {
                    if (reply.createdAt && reply.createdAt > latest) {
                      latest = reply.createdAt;
                    }
                  });
                }
                return latest ? new Date(latest).getTime() : 0;
              };

              const timeA = getLatestTime(a);
              const timeB = getLatestTime(b);

              return timeB - timeA;
            })
              .map((inquiry, index) => (
                <InquiryItem
                  key={inquiry.id || `inquiry-${index}`}
                  inquiry={inquiry}
                  isExpanded={expandedId === inquiry.id}
                  onToggle={() => handleToggle(inquiry)}
                  onSendReply={(pId, recId, title, body) => handleSendReply(pId, recId, title, body)}
                  onDelete={handleDelete}
                  currentUserId={currentUserId}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}