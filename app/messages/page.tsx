'use client';

import React, { useState } from 'react';
import ContactAdminModal from '@/components/ContactAdminModal';

export default function MessagesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      {/* 「管理者へメッセージを送る」ボタン */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full bg-[#1b365d] text-white font-bold py-3 px-4 rounded-xl shadow hover:bg-[#152a48] transition"
      >
        管理者へメッセージを送る
      </button>

      {/* 送信用モーダル */}
      <ContactAdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // メッセージ送了後に受信トレイ・送信履歴を再読み込みする処理
        }}
      />

      {/* 受信トレイ一覧など */}
      {/* ... */}
    </div>
  );
}