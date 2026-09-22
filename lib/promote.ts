import type { Listing, User } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./errors";

export const TIERS = [
  { id: "standard", label: "Standard", cents: 500, hours: 24 },
  { id: "plus", label: "Plus", cents: 1500, hours: 24 },
  { id: "top", label: "Top", cents: 4000, hours: 24 },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

export type PromotionSummary = { amountCents: number; endsAt: Date };

export function formatMoney(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function tierById(id: string) {
  return TIERS.find((tier) => tier.id === id) ?? null;
}

export async function promotionSummaries(ids: string[]) {
  const map = new Map<string, PromotionSummary>();
  if (!ids.length) return map;
  const rows = await prisma.promotion.findMany({
    where: { listingId: { in: ids }, endsAt: { gt: new Date() } },
  });
  for (const row of rows) {
    const current = map.get(row.listingId);
    if (!current) {
      map.set(row.listingId, { amountCents: row.amountCents, endsAt: row.endsAt });
      continue;
    }
    current.amountCents += row.amountCents;
    if (row.endsAt > current.endsAt) current.endsAt = row.endsAt;
  }
  return map;
}

export async function promotedListings() {
  const rows = await prisma.promotion.findMany({
    where: { endsAt: { gt: new Date() }, listing: { status: "published" } },
    include: { listing: { include: { author: true } } },
    orderBy: { createdAt: "desc" },
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

export async function promoteListing(user: User, slug: string, tierId: string) {
  const tier = tierById(tierId);
  if (!tier) {
    throw new ApiError(
      "invalid_input",
      "tier must be standard, plus, or top",
      "POST /api/v1/listings/{slug}/promote with tier standard ($5), plus ($15), or top ($40).",
      400,
    );
  }
  if (user.frozen) {
    throw new ApiError("frozen", "This account is frozen", "Frozen accounts cannot promote a listing.", 403);
  }
  const listing = await prisma.listing.findUnique({ where: { slug }, include: { author: true } });
  if (!listing) {
    throw new ApiError("not_found", "Listing not found", "Check the slug and try again.", 404);
  }
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
  const endsAt = new Date(Date.now() + tier.hours * 60 * 60 * 1000);
  const promotion = await prisma.promotion.create({
    data: {
      listingId: listing.id,
      payerId: user.id,
      amountCents: tier.cents,
      tier: tier.id,
      endsAt,
    },
  });
  const summary = (await promotionSummaries([listing.id])).get(listing.id);
  return {
    id: promotion.id,
    slug: listing.slug,
    tier: tier.id,
    amount_cents: tier.cents,
    ends_at: endsAt.toISOString(),
    rank_cents: summary?.amountCents ?? tier.cents,
    checkout: "local",
    message: "Payment recorded. No card was charged. This server has no card processor configured.",
    next_action: "The listing is in Promoted for 24 hours. A higher total payment ranks higher.",
  };
}
