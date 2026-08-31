/**
 * Login page (/login). Client credentials form.
 *
 * Calls next-auth signIn("credentials") with redirect:false so errors can
 * be shown inline (Japanese UI strings). On success it pushes "/" - the
 * root router decides the landing page per role - and router.refresh()
 * re-renders server components with the new session.
 * Auth logic itself lives in auth.ts (authorize checks the Users sheet).
 */
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // e = event
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Prevent the default form submission behavior
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      return;
    }
    router.push("/");
    router.refresh(); // Refresh the page to update the session state
  }

  return (
    // flex center
    <main className="theme-body flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm shadow-md">
        <h1 className="text-center font-medium text-brand">名古屋中支部</h1>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email" className="field-label">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input mb-4"
          />

          <label htmlFor="password" className="field-label">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />

          {error && <p className="field-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary btn-block mt-6">
            {loading ? "..." : "ログイン"}
          </button>
        </form>

        <p className="text-meta mt-4">
          パスワードを忘れた場合は、管理者（事務局）にご連絡ください。
        </p>
      </div>
    </main>
  );
}