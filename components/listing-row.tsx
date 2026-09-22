import type { Listing, User } from "@prisma/client";

export function showLiveDemo(listing: { demoUrl: string | null; urlStatus: number | null }) {
  const up = listing.urlStatus != null && listing.urlStatus >= 200 && listing.urlStatus < 400;
  return Boolean(listing.demoUrl) || up;
}

export function ListingRow({ listing }: { listing: Listing & { author: User } }) {
  const tags = listing.tags ? listing.tags.split(",").filter(Boolean) : [];
  return (
    <article className="row py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a href={`/p/${listing.slug}`} className="text-[17px] font-semibold text-ink no-underline">
          {listing.name}
        </a>
        <span>{listing.tagline}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span>{listing.type}</span>
        {tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        {showLiveDemo(listing) ? (
          <span className="rounded-lg border border-line px-2 py-0.5 text-ink">Live demo</span>
        ) : null}
        <a href={`/p/${listing.slug}`}>@{listing.author.handle}</a>
        <span className={listing.author.trust === "verified" ? "text-accent" : ""}>{listing.author.trust}</span>
        {listing.submittedBy === "agent" ? <span>Posted by agent</span> : null}
        <time dateTime={listing.createdAt.toISOString()}>
          {listing.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </time>
      </p>
    </article>
  );
}

export function ListingList({ listings }: { listings: (Listing & { author: User })[] }) {
  if (!listings.length) return <p className="text-muted">Nothing in this lane.</p>;
  return (
    <div>
      {listings.map((listing) => (
        <ListingRow key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
