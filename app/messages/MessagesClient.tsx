'use client';

import React, { useState, useEffect } from 'react';
import ContactAdminModal from '@/components/ContactAdminModal';
import InquiryItem, { ReceivedMessage } from '@/components/admin/messages/InquiryItem';

interface MessagesClientProps {
  currentUserId: string;
}

export default function MessagesClient({ currentUserId }: MessagesClientProps) {
  // ★ useSession の呼び出しは削除

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messages, setMessages] = useState<ReceivedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchMessages = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      
      const res = await fetch('/api/messages');
      const data = await res.json();
      
      if (data.success && Array.isArray(data.messages)) {
        const formattedMessages: ReceivedMessage[] = data.messages.map((item: any, idx: number) => ({
          id: String(item.id || item.message_id || `msg-${idx}`),
          senderId: item.senderId || item.sender_id || '',
          recipientId: item.recipientId || item.recipient_id || '',
          userName: item.userName || item.sender_name || '事務局',
          recipientName: item.recipientName || item.recipient_name || '事務局',
          memberId: item.memberId || item.member_id || '',
          subject: item.subject || item.title || '(件名なし)',
          body: item.body || '',
          isRead: Boolean(item.isRead ?? item.is_read),
          createdAt: item.createdAt || item.created_at || new Date().toISOString(),
          replies: (item.replies || []).map((r: any, rIdx: number) => ({
            id: String(r.id || r.reply_id || `reply-${idx}-${rIdx}`),
            senderId: r.senderId || r.sender_id || '',
            recipientId: r.recipientId || r.recipient_id || '',
            userName: r.userName || r.sender_name || '',
            recipientName: r.recipientName || r.recipient_name || '',
            memberId: r.memberId || r.member_id || '',
            subject: r.subject || r.title || '',
            body: r.body || '',
            isRead: Boolean(r.isRead ?? r.is_read),
            createdAt: r.createdAt || r.created_at || '',
          })),
        }));

        setMessages(formattedMessages);
      }
    } catch (err) {
      console.error('メッセージ取得エラー:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(false);

    const intervalId = setInterval(() => {
      fetchMessages(true);
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const handleToggle = async (msg: ReceivedMessage) => {
    const isTargetExpanded = expandedId === msg.id;
    const nextExpandedId = isTargetExpanded ? null : msg.id;
    setExpandedId(nextExpandedId);

    const hasUnread = !msg.isRead || msg.replies?.some((r) => !r.isRead);
    if (!isTargetExpanded && hasUnread) {
      try {
        const replyIds = msg.replies?.map((r) => r.id) || [];
        await fetch('/api/admin/inquiries/read', {
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
    recipientId: string,
    replyTitle: string,
    replyText: string
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
            {messages.map((inquiry, index) => (
              <InquiryItem
                key={inquiry.id || `inquiry-${index}`}
                inquiry={inquiry}
                isExpanded={expandedId === inquiry.id}
                onToggle={() => handleToggle(inquiry)}
                onSendReply={handleSendReply}
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