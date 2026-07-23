import type { NextAuthConfig } from "next-auth";

// ── edge-safe: not import google-spreadsheet/bcrypt → can use proxy
export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // real providers are in auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role; // put role into token at login
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string | undefined; // token → session
        if (token.sub) session.user.id = token.sub; // token.sub = member_id
      }
      return session;
    },
    // authorized proxy for every request that matches the matcher
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      if (pathname.startsWith("/login")) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      if (!isLoggedIn) return false; // → NextAuth will redirect to /login

      if (pathname.startsWith("/admin") && auth?.user?.role !== "admin") {
        return Response.redirect(new URL("/dashboard", nextUrl)); // general cannot access admin pages
      }
      return true;
    },
  },
} satisfies NextAuthConfig;