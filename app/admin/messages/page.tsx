'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { formatRelativeDateTime } from '@/lib/datetime';

type Group = {
  group_id: string;
  group_name: string;
};

type ReplyMessage = {
  id: string;
  senderId: string;
  userName: string;
  memberId?: string;
  subject: string;
  body: string;
  isRead?: boolean;
  createdAt: string;
};

type ReceivedMessage = {
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

export default function AdminMessagePage() {
  const [targetType, setTargetType] = useState<'all' | 'group' | 'individual'>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [individualInput, setIndividualInput] = useState<string>('');

  const [rawTitle, setRawTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  const [inquiries, setInquiries] = useState<ReceivedMessage[]>([]);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [replyTextMap, setReplyTextMap] = useState<{ [key: string]: string }>({});
  const [isReplyingMap, setIsReplyingMap] = useState<{ [key: string]: boolean }>({});

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

  const fetchInquiries = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingInquiries(true);
    try {
      const res = await fetch('/api/admin/inquiries');
      const data = await res.json();
      if (data.success && Array.isArray(data.inquiries)) {
        setInquiries(data.inquiries);
        setLastUpdated(
          new Date().toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );

        let unreadTotal = 0;
        data.inquiries.forEach((item: ReceivedMessage) => {
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
  }, [notifyUnreadCountChange]);

  useEffect(() => {
    fetchInquiries(false);
    const intervalId = setInterval(() => {
      fetchInquiries(true);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [fetchInquiries]);

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const target = groups.find((g) => g.group_id === groupId);
    setSelectedGroupName(target ? target.group_name : '');
  };

  const getPrefix = () => {
    if (targetType === 'all') return '(全会員)';
    if (targetType === 'group') return selectedGroupName ? `(${selectedGroupName})` : '(グループ)';
    return '';
  };

  const getFormattedTitle = () => {
    const prefix = getPrefix();
    return prefix ? `${prefix} ${rawTitle}` : rawTitle;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rawTitle.trim() || !body.trim()) {
      alert('件名と本文を入力してください');
      return;
    }

    let recipientId = 'all';
    if (targetType === 'group') {
      if (!selectedGroupId) {
        alert('グループを選択してください');
        return;
      }
      recipientId = selectedGroupId;
    } else if (targetType === 'individual') {
      if (!individualInput.trim()) {
        alert('宛先を入力してください');
        return;
      }
      recipientId = individualInput.trim();
    }

    setIsSending(true);

    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: recipientId,
          title: getFormattedTitle(),
          body: body,
          url: '/messages',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert(`送信が完了しました（対象: ${data.savedCount || 1}名）`);
        setRawTitle('');
        setBody('');
      } else {
        alert(`送信エラー: ${data.error || '送信に失敗しました'}`);
      }
    } catch (err: any) {
      alert(`通信エラー: ${err.message || '送信処理中にエラーが発生しました'}`);
    } finally {
      setIsSending(false);
    }
  };

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

  const toggleExpand = (inquiry: ReceivedMessage) => {
    const isOpening = expandedId !== inquiry.id;
    setExpandedId(isOpening ? inquiry.id : null);

    if (isOpening) {
      const hasUnread = !inquiry.isRead || (inquiry.replies && inquiry.replies.some((r) => !r.isRead));
      if (hasUnread) {
        handleMarkAsRead(inquiry);
      }
    }
  };

  const handleSendInlineReply = async (inquiry: ReceivedMessage) => {
    const text = replyTextMap[inquiry.id]?.trim();
    if (!text) {
      alert('返信内容を入力してください');
      return;
    }

    setIsReplyingMap((prev) => ({ ...prev, [inquiry.id]: true }));

    try {
      const cleanSubject = inquiry.subject.replace(/^Re:\s*/i, '').trim();
      const replyTitle = `Re: ${cleanSubject}`;

      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: inquiry.senderId,
          title: replyTitle,
          body: text,
          url: '/messages',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setReplyTextMap((prev) => ({ ...prev, [inquiry.id]: '' }));
        await fetchInquiries(true);
      } else {
        alert(`送信エラー: ${data.error || '返信の送信に失敗しました'}`);
      }
    } catch (err: any) {
      alert(`通信エラー: ${err.message}`);
    } finally {
      setIsReplyingMap((prev) => ({ ...prev, [inquiry.id]: false }));
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

      {/* 1. メッセージ作成・送信 */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-base font-bold text-slate-800 mb-4">メッセージを作成・送信</h3>

        <form onSubmit={handleSend} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                送信先
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="all">全会員</option>
                <option value="group">グループ指定</option>
                <option value="individual">個人指定</option>
              </select>
            </div>

            {targetType === 'group' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  グループ選択
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">グループを選択してください</option>
                  {groups.map((g, index) => {
                    const id = g.group_id || `group_${index}`;
                    return (
                      <option key={id} value={id}>
                        {g.group_name} {id ? `(${id})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {targetType === 'individual' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  宛先 (会員ID または 氏名)
                </label>
                <input
                  type="text"
                  placeholder="例: MEM_001"
                  value={individualInput}
                  onChange={(e) => setIndividualInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              件名
            </label>
            <div className="flex items-center space-x-2">
              {getPrefix() && (
                <span className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 whitespace-nowrap">
                  {getPrefix()}
                </span>
              )}
              <input
                type="text"
                placeholder="件名を入力してください"
                value={rawTitle}
                onChange={(e) => setRawTitle(e.target.value)}
                className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              本文
            </label>
            <textarea
              rows={5}
              placeholder="メッセージ本文を入力してください..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 resize-y"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() =>
                alert(`【送信予定の件名】\n${getFormattedTitle() || '(未入力)'}\n\n【本文】\n${body || '(未入力)'}`)
              }
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
            >
              プレビュー
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-6 py-2 bg-[#1b365d] hover:bg-[#142845] text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isSending ? '送信中...' : '送信する'}
            </button>
          </div>
        </form>
      </section>

      {/* 2. 受信メッセージ */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-base font-bold text-slate-800">
              受信メッセージ（問い合わせ）
            </h3>
            {unreadCountTotal > 0 && (
              <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                未読 {unreadCountTotal}件
              </span>
            )}
          </div>
          {lastUpdated && (
            <span className="text-xs text-slate-400">最終更新: {lastUpdated}</span>
          )}
        </div>

        {isLoadingInquiries ? (
          <p className="text-sm text-slate-500 py-4">読み込み中...</p>
        ) : inquiries.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">管理者宛てのメッセージはありません</p>
        ) : (
          <div className="space-y-4">
            {inquiries.map((item) => {
              const isExpanded = expandedId === item.id;
              const replyText = replyTextMap[item.id] || '';
              const isReplying = isReplyingMap[item.id] || false;
              const hasThreadUnread = !item.isRead || (item.replies && item.replies.some((r) => !r.isRead));

              return (
                <div
                  key={item.id}
                  className={`border rounded-xl transition overflow-hidden ${
                    hasThreadUnread
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div
                    onClick={() => toggleExpand(item)}
                    className="p-4 cursor-pointer hover:bg-slate-50/80 transition flex items-start justify-between"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-full bg-[#1b365d] text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {item.userName ? item.userName.charAt(0) : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{item.userName}</span>
                          <span className="text-xs text-slate-500">({item.memberId || item.senderId})</span>
                          {hasThreadUnread && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                              未読あり
                            </span>
                          )}
                        </div>
                        <p className={`text-sm mt-0.5 ${hasThreadUnread ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                          {item.subject}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* ★ formatRelativeDateTime で相対日時表示 */}
                      <span className="text-xs text-slate-400">
                        {formatRelativeDateTime(item.createdAt)}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition"
                      >
                        {isExpanded ? '閉じる' : '返信'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-5 pt-2 border-t border-slate-200 bg-slate-50/50 space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap">
                        <p className="text-xs text-slate-400 mb-1 font-semibold">【問い合わせ本文】</p>
                        {item.body}
                      </div>

                      {item.replies && item.replies.length > 0 && (
                        <div className="pl-6 space-y-3 border-l-2 border-blue-400">
                          <p className="text-xs font-bold text-slate-600">返信履歴</p>
                          {item.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="bg-blue-50/70 border border-blue-100 p-3 rounded-lg text-sm"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs text-blue-900">
                                  {reply.userName} ({reply.memberId || reply.senderId})
                                </span>
                                {/* ★ formatRelativeDateTime で相対日時表示 */}
                                <span className="text-[11px] text-slate-400">
                                  {formatRelativeDateTime(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-slate-800 whitespace-pre-wrap">{reply.body}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                        <label className="block text-xs font-bold text-slate-700">
                          {item.userName} 様へ返信
                        </label>
                        <textarea
                          rows={3}
                          placeholder="返信内容を入力してください..."
                          value={replyText}
                          onChange={(e) =>
                            setReplyTextMap((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1b365d] resize-y"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSendInlineReply(item)}
                            disabled={isReplying || !replyText.trim()}
                            className="px-5 py-2 bg-[#1b365d] hover:bg-[#142845] text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                          >
                            {isReplying ? '送信中...' : '返信を送信'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}