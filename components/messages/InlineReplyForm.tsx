/**
 * Inline reply box inside an expanded thread (InquiryItem). Pure form:
 * collects the text and delegates sending to the onSendReply callback
 * supplied by the page-level client, which owns API calls and refresh.
 */
"use client";

import React, { useState } from "react";

interface InlineReplyFormProps {
  parentMessageId: string; // 親メッセージの message_id
  userName: string;
  recipientId: string;
  subject: string;
  onSendReply: (
    parentMessageId: string,
    recipientId: string,
    replyTitle: string,
    replyText: string,
  ) => Promise<boolean>;
}

export default function InlineReplyForm({
  parentMessageId,
  userName,
  recipientId,
  subject,
  onSendReply,
}: InlineReplyFormProps) {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text) {
      alert("返信内容を入力してください");
      return;
    }

    setIsReplying(true);
    const cleanSubject = subject.replace(/^Re:\s*/i, "").trim();
    const replyTitle = `Re: ${cleanSubject}`;

    // ★ 親メッセージの parentMessageId も一緒に引き渡す
    const success = await onSendReply(
      parentMessageId,
      recipientId,
      replyTitle,
      text,
    );
    setIsReplying(false);

    if (success) {
      setReplyText("");
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
      <label className="block text-xs font-bold text-slate-700">
        {userName} 様へ返信
      </label>
      <textarea
        rows={3}
        placeholder="返信内容を入力してください..."
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1b365d] resize-y"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSend}
          disabled={isReplying || !replyText.trim()}
          className="px-5 py-2 bg-[#1b365d] hover:bg-[#142845] text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
        >
          {isReplying ? "送信中..." : "返信を送信"}
        </button>
      </div>
    </div>
  );
}
