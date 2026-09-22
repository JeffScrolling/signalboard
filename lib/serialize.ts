import type { Listing, User } from "@prisma/client";
import { appUrl } from "./env";
import type { PromotionSummary } from "./promote";

export type ListingWithAuthor = Listing & { author: User };

export function serializeListing(listing: ListingWithAuthor, promotion?: PromotionSummary | null) {
  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    tagline: listing.tagline,
    description: listing.description,
    type: listing.type,
    url: listing.url,
    final_url: listing.finalUrl,
    page_url: `${appUrl()}/p/${listing.slug}`,
    repo_url: listing.repoUrl,
    demo_url: listing.demoUrl,
    logo_url: listing.logoUrl,
    tags: listing.tags ? listing.tags.split(",").filter(Boolean) : [],
    status: listing.status,
    url_status: listing.urlStatus,
    submitted_by: listing.submittedBy,
    author: {
      handle: listing.author.handle,
      name: listing.author.name,
      kind: listing.author.kind,
      trust: listing.author.trust,
    },
    created_at: listing.createdAt.toISOString(),
    promotion: promotion
      ? { amount_cents: promotion.amountCents, ends_at: promotion.endsAt.toISOString() }
      : null,
  };
}

export type ListingJson = ReturnType<typeof serializeListing>;
