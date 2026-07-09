import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// mock user
const MOCK_USER = {
  id: "1",
  email: "test@example.com",
  password: "password123", // will bcrypt hash in Sheets later
  name: "山田 太郎",
  role: "general",
  status: "active",
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" }, // our login page
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const ok = email === MOCK_USER.email && password === MOCK_USER.password;
        if (!ok) return null;
        if (MOCK_USER.status !== "active") return null;

        // return user → as session (!returning password)
        return { id: MOCK_USER.id, email: MOCK_USER.email, name: MOCK_USER.name };
      },
    }),
  ],
});