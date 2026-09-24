import type { Listing, User } from "@prisma/client";
import { prisma } from "./db";
import { appUrl } from "./env";
import { ApiError } from "./errors";

export const TIERS = [
  { id: "standard", label: "Standard", cents: 500, hours: 24 },
  { id: "plus", label: "Plus", cents: 1500, hours: 24 },
  { id: "top", label: "Top", cents: 4000, hours: 24 },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

export type PromotionSummary = { amountCents: number; endsAt: Date };

const HOUR = 60 * 60 * 1000;

export function formatMoney(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function tierById(id: string) {
  return TIERS.find((tier) => tier.id === id) ?? null;
}

export function checkoutMode() {
  if (process.env.NODE_ENV !== "production" && process.env.PROMOTE_CHECKOUT === "local") return "local" as const;
  return "unavailable" as const;
}

function assertCheckoutOpen() {
  if (checkoutMode() !== "local") {
    throw new ApiError(
      "checkout_unavailable",
      "Checkout is not open on this server.",
      "Set up card checkout before taking a promotion payment.",
      503,
    );
  }
}

function assertCanPay(user: User) {
  if (user.frozen) {
    throw new ApiError("frozen", "This account is frozen", "Frozen accounts cannot promote a listing.", 403);
  }
  if (user.trust !== "claimed" && user.trust !== "verified") {
    throw new ApiError(
      "unauthorized",
      "Claim the account before paying",
      "Open the claim link, confirm the account, then pay.",
      401,
    );
  }
}

function paidWhere(listingId?: string) {
  return {
    status: "paid" as const,
    endsAt: { gt: new Date() },
    listing: { status: "published", author: { frozen: false } },
    ...(listingId ? { listingId } : {}),
  };
}

export async function paidWindows(listingId: string) {
  const rows = await prisma.promotion.findMany({
    where: paidWhere(listingId),
    orderBy: { endsAt: "asc" },
  });
  let sum = rows.reduce((total, row) => total + row.amountCents, 0);
  const windows: PromotionSummary[] = [];
  for (const row of rows) {
    const previous = windows[windows.length - 1];
    if (previous && previous.endsAt.getTime() === row.endsAt.getTime()) {
      previous.amountCents = sum;
    } else {
      windows.push({ amountCents: sum, endsAt: row.endsAt });
    }
    sum -= row.amountCents;
  }
  return windows;
}

export function formatWindows(windows: PromotionSummary[]) {
  return windows
    .map((window, index) => {
      const when = window.endsAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const money = formatMoney(window.amountCents);
      return index === 0 ? `${money} until ${when}` : `then ${money} until ${when}`;
    })
    .join(", ");
}

export async function promotionSummaries(ids: string[]) {
  const map = new Map<string, PromotionSummary>();
  if (!ids.length) return map;
  const rows = await prisma.promotion.findMany({
    where: { ...paidWhere(), listingId: { in: ids } },
  });
  const byListing = new Map<string, { amountCents: number; endsAt: Date }>();
  for (const row of rows) {
    const current = byListing.get(row.listingId);
    if (!current) {
      byListing.set(row.listingId, { amountCents: row.amountCents, endsAt: row.endsAt });
      continue;
    }
    current.amountCents += row.amountCents;
    if (row.endsAt > current.endsAt) current.endsAt = row.endsAt;
  }
  for (const [id, summary] of byListing) map.set(id, summary);
  return map;
}

export async function promotedListings() {
  const rows = await prisma.promotion.findMany({
    where: paidWhere(),
    include: { listing: { include: { author: true } } },
    orderBy: { endsAt: "desc" },
  });
  const grouped = new Map<string, { listing: Listing & { author: User }; promotion: PromotionSummary }>();
  for (const row of rows) {
    const current = grouped.get(row.listingId);
    if (!current) {
      grouped.set(row.listingId, {
        listing: row.listing,
        promotion: { amountCents: row.amountCents, endsAt: row.endsAt },
      });
      continue;
    }
    current.promotion.amountCents += row.amountCents;
    if (row.endsAt > current.promotion.endsAt) current.promotion.endsAt = row.endsAt;
  }
  return [...grouped.values()].sort(
    (a, b) => b.promotion.amountCents - a.promotion.amountCents || b.promotion.endsAt.getTime() - a.promotion.endsAt.getTime(),
  );
}

function intentBody(promotion: { id: string; tier: string; amountCents: number; status: string; endsAt: Date }, slug: string, replay: boolean) {
  return {
    replay,
    body: {
      id: promotion.id,
      slug,
      tier: promotion.tier,
      amount_cents: promotion.amountCents,
      status: promotion.status,
      ends_at: promotion.status === "paid" ? promotion.endsAt.toISOString() : null,
      checkout_url: `${appUrl()}/promote/${slug}?intent=${promotion.id}`,
      checkout: checkoutMode(),
      message:
        promotion.status === "paid"
          ? "Payment recorded. No card was charged on this machine."
          : "Open checkout_url and confirm. Rank starts after the owner confirms.",
      next_action: "The owner opens checkout_url and confirms. A higher total ranks higher for 24 hours.",
    },
  };
}

export async function createPromotionIntent(user: User, slug: string, tierId: string, idempotencyKey: string) {
  assertCheckoutOpen();
  const tier = tierById(tierId);
  if (!tier) {
    throw new ApiError(
      "invalid_input",
      "tier must be standard, plus, or top",
      "Send tier standard ($5), plus ($15), or top ($40).",
      400,
    );
  }
  if (!idempotencyKey || idempotencyKey.length > 120) {
    throw new ApiError(
      "invalid_input",
      "Idempotency-Key is required",
      "Send an Idempotency-Key header. Reuse it if you retry.",
      400,
    );
  }
  assertCanPay(user);
  const listing = await prisma.listing.findUnique({ where: { slug } });
  if (!listing) throw new ApiError("not_found", "Listing not found", "Check the slug and try again.", 404);
  if (listing.authorId !== user.id) {
    throw new ApiError(
      "unauthorized",
      "Only the listing owner can pay to promote it",
      "Sign in as the owner, or send the owner's API key.",
      401,
    );
  }
  if (listing.status !== "published") {
    throw new ApiError(
      "invalid_input",
      "Only a published listing can be promoted",
      "Claim the account so the listing can publish, then pay.",
      400,
    );
  }
  const existing = await prisma.promotion.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.payerId !== user.id || existing.listingId !== listing.id) {
      throw new ApiError("invalid_input", "Idempotency-Key was already used", "Send a new Idempotency-Key for a new payment.", 400);
    }
    return intentBody(existing, slug, true);
  }
  const promotion = await prisma.promotion.create({
    data: {
      listingId: listing.id,
      payerId: user.id,
      amountCents: tier.cents,
      tier: tier.id,
      status: "pending",
      idempotencyKey,
      endsAt: new Date(Date.now() + tier.hours * HOUR),
    },
  });
  return intentBody(promotion, slug, false);
}

export async function confirmLocalPromotion(user: User, promotionId: string) {
  assertCheckoutOpen();
  assertCanPay(user);
  const promotion = await prisma.promotion.findUnique({ where: { id: promotionId }, include: { listing: true } });
  if (!promotion) throw new ApiError("not_found", "Checkout was not found", "Start again from the listing.", 404);
  if (promotion.listing.authorId !== user.id) {
    throw new ApiError("unauthorized", "Only the owner can confirm this payment", "Sign in as the owner.", 401);
  }
  if (promotion.status === "paid") return promotion;
  if (promotion.status !== "pending") {
    throw new ApiError("invalid_input", "This checkout is no longer open", "Start a new promotion from the listing.", 400);
  }
  if (promotion.listing.status !== "published") {
    throw new ApiError("invalid_input", "Only a published listing can be promoted", "Publish the listing, then pay.", 400);
  }
  const tier = tierById(promotion.tier);
  const hours = tier?.hours ?? 24;
  return prisma.promotion.update({
    where: { id: promotion.id },
    data: {
      status: "paid",
      paidAt: new Date(),
      endsAt: new Date(Date.now() + hours * HOUR),
    },
  });
}

export async function voidPromotion(promotionId: string) {
  return prisma.promotion.update({
    where: { id: promotionId },
    data: { status: "refunded", refundedAt: new Date() },
  });
}
