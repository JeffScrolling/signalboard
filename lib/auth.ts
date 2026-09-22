import { createHash, randomBytes } from "crypto";
import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";
import EmailProvider from "next-auth/providers/email";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "./db";
import { appUrl } from "./env";
import { sendMail } from "./mail";

type StoredToken = VerificationToken;

const globalTokens = globalThis as unknown as {
  __sbTokens?: Map<string, StoredToken>;
};

function tokens() {
  if (!globalTokens.__sbTokens) globalTokens.__sbTokens = new Map();
  return globalTokens.__sbTokens;
}

function tokenKey(identifier: string, token: string) {
  return `${identifier}\0${token}`;
}

function toAdapter(user: {
  id: string;
  email: string;
  emailClaimed: boolean;
  name: string | null;
  createdAt: Date;
}): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailClaimed ? user.createdAt : null,
    name: user.name,
    image: null,
  };
}

async function uniqueHandle(email: string) {
  const local = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
  const base = local.length >= 3 ? local : `user-${randomBytes(2).toString("hex")}`;
  for (let i = 0; i < 40; i += 1) {
    const handle = i === 0 ? base : `${base.slice(0, 26)}-${i + 1}`;
    const found = await prisma.user.findUnique({ where: { handle } });
    if (!found) return handle;
  }
  return `user-${randomBytes(4).toString("hex")}`;
}

export const adapter: Adapter = {
  async createUser(user: Omit<AdapterUser, "id">) {
    const email = user.email.toLowerCase();
    const created = await prisma.user.create({
      data: {
        handle: await uniqueHandle(email),
        name: user.name,
        email,
        kind: "human",
        trust: "provisional",
        emailClaimed: false,
      },
    });
    return toAdapter(created);
  },
  async getUser(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? toAdapter(user) : null;
  },
  async getUserByEmail(email) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return user ? toAdapter(user) : null;
  },
  async getUserByAccount({ provider, providerAccountId }) {
    if (provider !== "github") return null;
    const user = await prisma.user.findUnique({ where: { githubId: providerAccountId } });
    return user ? toAdapter(user) : null;
  },
  async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
    const existing = await prisma.user.findUnique({ where: { id: user.id } });
    if (!existing) throw new Error("User not found");
    const data: {
      name?: string | null;
      email?: string;
      emailClaimed?: boolean;
      trust?: string;
    } = {};
    if (typeof user.name !== "undefined") data.name = user.name;
    if (user.email && user.email.toLowerCase() !== existing.email) data.email = user.email.toLowerCase();
    if (user.emailVerified && existing.kind === "human") {
      data.emailClaimed = true;
      data.trust = existing.githubId ? "verified" : "claimed";
    }
    const updated = Object.keys(data).length
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : existing;
    return toAdapter(updated);
  },
  async linkAccount(account: AdapterAccount) {
    if (account.provider === "github") {
      await prisma.user.update({
        where: { id: account.userId },
        data: { githubId: account.providerAccountId },
      });
    }
  },
  async createSession(session: AdapterSession) {
    return session;
  },
  async getSessionAndUser() {
    return null;
  },
  async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">) {
    return {
      sessionToken: session.sessionToken,
      userId: session.userId || "",
      expires: session.expires || new Date(),
    };
  },
  async deleteSession() {
    return;
  },
  async createVerificationToken(token) {
    tokens().set(tokenKey(token.identifier.toLowerCase(), token.token), {
      ...token,
      identifier: token.identifier.toLowerCase(),
    });
    return token;
  },
  async useVerificationToken({ identifier, token }) {
    const key = tokenKey(identifier.toLowerCase(), token);
    const stored = tokens().get(key);
    tokens().delete(key);
    if (!stored) return null;
    if (stored.expires.getTime() < Date.now()) return null;
    return stored;
  },
};

async function applySignIn(email: string, provider: string, providerAccountId?: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.frozen) return;
  if (provider === "github" && providerAccountId) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        githubId: providerAccountId,
        trust: user.emailClaimed ? "verified" : "claimed",
      },
    });
    return;
  }
  if (provider === "email" && user.kind === "human") {
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailClaimed: true,
        trust: fresh?.githubId ? "verified" : "claimed",
      },
    });
  }
}

const providers: NextAuthOptions["providers"] = [
  EmailProvider({
    from: process.env.EMAIL_FROM || "noreply@localhost",
    maxAge: 72 * 60 * 60,
    async sendVerificationRequest({ identifier, url }) {
      const line = `[signalboard] magic link for ${identifier}: ${url}`;
      if (process.env.NODE_ENV !== "production") console.log(line);
      await sendMail(identifier, "Sign in to Signalboard", url);
    },
  }),
];

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.unshift(
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter,
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      if (!token.uid && token.email) {
        const row = await prisma.user.findUnique({ where: { email: token.email.toLowerCase() } });
        if (row) token.uid = row.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!user.email || !account) return;
      await applySignIn(user.email, account.provider, account.providerAccountId);
    },
  },
};

export async function createMagicLink(email: string, callbackPath: string) {
  const identifier = email.trim().toLowerCase();
  const plain = randomBytes(32).toString("hex");
  const secret = process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
  const hashed = createHash("sha256").update(`${plain}${secret}`).digest("hex");
  const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);
  await adapter.createVerificationToken?.({ identifier, token: hashed, expires });
  const callbackUrl = `${appUrl()}${callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`}`;
  return `${appUrl()}/api/auth/callback/email?callbackUrl=${encodeURIComponent(callbackUrl)}&token=${encodeURIComponent(plain)}&email=${encodeURIComponent(identifier)}`;
}
