import NextAuth from "next-auth";
import authConfig from "@/auth.config";

export const{ auth: middleware } = NextAuth(authConfig); // instance from config, edge-safe
export default middleware; // default export for Next.js middleware

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};