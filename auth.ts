import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/sheets";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
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

        const user = await getUserByEmail(email); // find user by email
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password_hash); // compare password with hash
        if (!ok) return null;

        if (user.status !== "active") return null; // inactive user cannot login

        // Return user object with id, email, and name
        return { id: user.member_id, email: user.email, name: user.user_name };
      },
    }),
  ],
});