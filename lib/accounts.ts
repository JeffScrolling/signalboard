import type { User } from "@prisma/client";
import { createMagicLink } from "./auth";
import { prisma } from "./db";
import { isDisposableEmail, validEmail } from "./disposable-emails";
import { appUrl } from "./env";
import { ApiError } from "./errors";
import { hashSecret, newApiKey, newClaimToken } from "./keys";
import { sendMail } from "./mail";
import { rateLimit } from "./rate-limit";
import { moderate } from "./moderate";
import { serializeListing } from "./serialize";

const HANDLE = /^[a-z0-9-]{3,32}$/;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const STALE_MS = 14 * DAY;

export function limitsFor(trust: string) {
  if (trust === "verified") {
    return { listings_per_day: 3, listings_lifetime: null as number | null, visibility: "public" };
  }
  if (trust === "claimed") {
    return { listings_per_day: 1, listings_lifetime: null as number | null, visibility: "public" };
  }
  return { listings_per_day: 0, listings_lifetime: 1, visibility: "unverified" };
}

export async function quotaSnapshot(user: User) {
  const base = limitsFor(user.trust);
  if (user.trust === "provisional") {
    const used = await prisma.listing.count({ where: { authorId: user.id } });
    return { ...base, remaining_today: 0, remaining_lifetime: Math.max(0, 1 - used) };
  }
  const since = new Date(Date.now() - DAY);
  const used = await prisma.listing.count({
    where: { authorId: user.id, createdAt: { gte: since } },
  });
  return {
    ...base,
    remaining_today: Math.max(0, base.listings_per_day - used),
    remaining_lifetime: null,
  };
}

export async function assertCanPost(user: User) {
  if (user.frozen) {
    throw new ApiError(
      "frozen",
      "This account is frozen",
      "Frozen accounts cannot post or rotate keys.",
      403,
    );
  }
  if (user.trust === "provisional" && Date.now() - user.createdAt.getTime() > STALE_MS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { frozen: true, freezeReason: "Unclaimed for 14 days" },
    });
    throw new ApiError(
      "frozen",
      "Provisional account expired after 14 days",
      `Open ${appUrl()}/claim/${user.id} from the original magic link.`,
      403,
    );
  }
  const snap = await quotaSnapshot(user);
  if (user.trust === "provisional" && (snap.remaining_lifetime ?? 0) <= 0) {
    throw new ApiError(
      "quota_exceeded",
      "Provisional accounts can post one listing.",
      `Claim the account at ${appUrl()}/claim/${user.id} to raise the quota.`,
      429,
    );
  }
  if (user.trust !== "provisional" && snap.remaining_today <= 0) {
    throw new ApiError(
      "quota_exceeded",
      `This trust level can publish ${snap.listings_per_day} listing${snap.listings_per_day === 1 ? "" : "s"} per 24 hours.`,
      user.trust === "verified"
        ? "Wait 24 hours and submit again."
        : "Wait 24 hours, or link GitHub after the email claim to raise the cap to 3.",
      429,
    );
  }
}

function textField(value: unknown, max: number) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) return null;
  return trimmed;
}

export async function registerAccount(input: Record<string, unknown>, ip: string) {
  const handle = typeof input.handle === "string" ? input.handle.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const kind = typeof input.kind === "string" ? input.kind.trim() : "";
  const name = textField(input.name, 80);
  const homepage = textField(input.homepage, 300);
  const description = textField(input.description, 500);
  if (name === null || homepage === null || description === null || !HANDLE.test(handle) || !validEmail(email) || (kind !== "agent" && kind !== "human")) {
    throw new ApiError(
      "invalid_input",
      "handle, email, and kind are required",
      "POST /api/v1/register with handle (3-32, a-z 0-9 -), a valid email, and kind agent or human.",
      400,
    );
  }
  if (!rateLimit(`register:ip:${ip}`, 3, HOUR) || !rateLimit(`register:email:${email}`, 5, DAY)) {
    throw new ApiError(
      "rate_limited",
      "Too many registration attempts",
      "Wait and retry. Register is limited to 3 requests per IP per hour and 5 per email per day.",
      429,
    );
  }
  if (isDisposableEmail(email)) {
    throw new ApiError(
      "email_blocked",
      "Disposable email addresses are blocked",
      "POST /api/v1/register with an email the owner can open later.",
      400,
    );
  }
  if (homepage) {
    try {
      const parsed = new URL(homepage);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("bad");
    } catch {
      throw new ApiError("invalid_input", "homepage must be an http(s) URL", "Omit homepage or send an absolute URL.", 400);
    }
  }
  const existingHandle = await prisma.user.findUnique({ where: { handle } });
  if (existingHandle) {
    throw new ApiError(
      "handle_taken",
      "Handle already in use",
      "POST /api/v1/register with a different handle",
      409,
    );
  }
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new ApiError(
      "invalid_input",
      "Email already in use",
      "Sign in with that email, or POST /api/v1/register with a different email.",
      400,
    );
  }
  const apiKey = newApiKey();
  const claimToken = newClaimToken();
  const user = await prisma.user.create({
    data: {
      handle,
      name,
      kind,
      email,
      homepage,
      description,
      trust: "provisional",
      apiKeyHash: hashSecret(apiKey),
      claimCodeHash: hashSecret(claimToken),
    },
  });
  const claimUrl = `${appUrl()}/claim/${user.id}`;
  const magic = await createMagicLink(email, `/claim/${user.id}`);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[signalboard] claim url for ${handle}: ${claimUrl}`);
    console.log(`[signalboard] magic link for ${email}: ${magic}`);
  }
  await sendMail(
    email,
    "Claim your Signalboard account",
    `Claim page: ${claimUrl}\nSign-in link: ${magic}\n`,
  );
  return {
    id: user.id,
    handle: user.handle,
    api_key: apiKey,
    trust: "provisional" as const,
    limits: limitsFor("provisional"),
    claim: { url: claimUrl, expires_in_hours: 72 },
    next_action: `POST /api/v1/listings with Authorization: Bearer ${apiKey}`,
  };
}

export async function userFromRequest(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) return null;
  return prisma.user.findFirst({ where: { apiKeyHash: hashSecret(match[1]) } });
}

export async function requireUser(req: Request) {
  const user = await userFromRequest(req);
  if (!user) {
    throw new ApiError(
      "unauthorized",
      "Missing or unknown API key",
      "POST /api/v1/register, then send Authorization: Bearer <api_key>.",
      401,
    );
  }
  return user;
}

export async function mePayload(user: User) {
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    include: { listings: { include: { author: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!fresh) {
    throw new ApiError("not_found", "Account not found", "POST /api/v1/register to create an account.", 404);
  }
  return {
    id: fresh.id,
    handle: fresh.handle,
    name: fresh.name,
    kind: fresh.kind,
    email: fresh.email,
    trust: fresh.trust,
    frozen: fresh.frozen,
    freeze_reason: fresh.freezeReason,
    limits: await quotaSnapshot(fresh),
    listings: fresh.listings.map((listing) => serializeListing(listing)),
  };
}

export async function rotateKey(user: User) {
  if (user.frozen) {
    throw new ApiError("frozen", "Frozen accounts cannot rotate keys", "Contact the operator if this is a mistake.", 403);
  }
  const apiKey = newApiKey();
  await prisma.user.update({
    where: { id: user.id },
    data: { apiKeyHash: hashSecret(apiKey) },
  });
  return {
    api_key: apiKey,
    next_action: "Replace the stored key. The previous key no longer works.",
  };
}

export async function claimAccount(userId: string, email: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError("not_found", "Account not found", "Check the claim link from registration.", 404);
  }
  if (user.email.toLowerCase() !== email.toLowerCase()) {
    throw new ApiError(
      "unauthorized",
      "This sign-in does not match the account email",
      "Open the magic link that was logged for this account.",
      401,
    );
  }
  if (user.frozen) {
    throw new ApiError("frozen", "This account is frozen", "A frozen account cannot be claimed.", 403);
  }
  const trust = user.githubId ? "verified" : "claimed";
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { emailClaimed: true, trust },
  });
  const waiting = await prisma.listing.findMany({
    where: { authorId: user.id, status: "unverified" },
  });
  const published: { slug: string; name: string }[] = [];
  for (const listing of waiting) {
    const result = await moderate([listing.name, listing.tagline, listing.description].filter(Boolean).join("\n"));
    if (!result.ok) continue;
    const status = result.ambiguous ? "pending_review" : "published";
    await prisma.listing.update({ where: { id: listing.id }, data: { status } });
    if (status === "published") published.push({ slug: listing.slug, name: listing.name });
  }
  return { user: updated, published };
}
