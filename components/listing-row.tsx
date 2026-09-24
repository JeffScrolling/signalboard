import type { Listing, User } from "@prisma/client";
import { formatMoney, type PromotionSummary } from "@/lib/promote";

export type FeedListing = Listing & { author: User; promotion?: PromotionSummary | null };

export function showLiveDemo(listing: { demoUrl: string | null; urlStatus: number | null }) {
  const up = listing.urlStatus != null && listing.urlStatus >= 200 && listing.urlStatus < 400;
  return Boolean(listing.demoUrl) || up;
}

export function ListingRow({ listing }: { listing: FeedListing }) {
  const tags = listing.tags ? listing.tags.split(",").filter(Boolean) : [];
  return (
    <article className="row grid gap-1 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <a href={`/p/${listing.slug}`} className="text-[19px] font-semibold leading-tight text-ink no-underline">
          {listing.name}
        </a>
        {listing.promotion ? (
          <span className="text-sm font-medium text-accent">Paid placement · {formatMoney(listing.promotion.amountCents)}</span>
        ) : null}
      </div>
      <p className="max-w-[62ch]">{listing.tagline}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span>{listing.type}</span>
        {tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        {showLiveDemo(listing) ? (
          <span className="rounded-lg border border-line px-2 py-0.5 text-ink">Live demo</span>
        ) : null}
        <span>@{listing.author.handle}</span>
        <span className={listing.author.trust === "verified" ? "text-accent" : ""}>{listing.author.trust}</span>
        {listing.submittedBy === "agent" ? <span>Posted by agent</span> : null}
        <time dateTime={listing.createdAt.toISOString()}>
          {listing.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </time>
      </p>
    </article>
  );
}

export function ListingList({ listings, empty = "Nothing in this lane." }: { listings: FeedListing[]; empty?: string }) {
  if (!listings.length) return <p className="mt-3 text-muted">{empty}</p>;
  return (
    <div>
      {listings.map((listing) => (
        <ListingRow key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
