// ============================================================
// AUTH — NextAuth v5 (Auth.js) configuration
// Compatível com next-auth@5.0.0-beta.x
// ============================================================

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface User {
    plan?: string;
    role?: string;
  }
  interface Session {
    user: {
      id:    string;
      plan:  string;
      role:  string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

const config: NextAuthConfig = {
  adapter: PrismaAdapter(db),

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),

    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Senha",    type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where:  { email: String(credentials.email) },
          select: { id: true, email: true, name: true, password: true, plan: true, role: true },
        });

        if (!user?.password) return null;

        const ok = await bcrypt.compare(
          String(credentials.password),
          user.password
        );
        if (!ok) return null;

        return {
          id:    user.id,
          email: user.email,
          name:  user.name,
          plan:  user.plan,
          role:  user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.plan = user.plan ?? "FREE";
        token.role = user.role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id   = token.id as string;
      session.user.plan = (token.plan as string) ?? "FREE";
      session.user.role = (token.role as string) ?? "USER";
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

// Compatibilidade com código legado que usa getServerSession
export const authOptions = config;
