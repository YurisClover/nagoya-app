import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { role?: string;
        expiration_date?: string
     } & DefaultSession["user"];
    }
    interface User { 
        role?: string;
        expiration_date?: string;
    }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    expiration_date?: string;
  }
}