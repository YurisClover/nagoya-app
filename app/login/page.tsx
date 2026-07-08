"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    setLoading(true);
    console.log("submit:", { email }); // <- no log password
    await new Promise((r) => setTimeout(r, 500)); // Simulate waiting for server
    setError("（まだ認証は未実装です）");
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 360, margin: "60px auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>名古屋中支部</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="email" style={{ display: "block", fontSize: 12 }}>
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, margin: "4px 0 16px" }}
        />

        <label htmlFor="password" style={{ display: "block", fontSize: 12 }}>
          パスワード
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, margin: "4px 0 16px" }}
        />

        {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 10, marginTop: 8 }}
        >
          {loading ? "..." : "ログイン"}
        </button>
      </form>

      <p style={{ fontSize: 11, color: "#666", marginTop: 16 }}>
        パスワードを忘れた場合は、管理者（事務局）にご連絡ください。
      </p>
    </main>
  );
}