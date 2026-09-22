import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { requestMagicLink } from "@/app/submit/actions";
import { payForPromotion } from "./actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TIERS, formatMoney, promotionSummaries } from "@/lib/promote";

export const dynamic = "force-dynamic";

export default async function PromoteListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const listing = await prisma.listing.findUnique({ where: { slug }, include: { author: true } });
  if (!listing || listing.status === "blocked") notFound();
  const session = await getServerSession(authOptions);
  const viewer = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } })
    : null;
  const owns = viewer?.id === listing.authorId;
  const current = (await promotionSummaries([listing.id])).get(listing.id);
  return (
    <>
      <p className="text-sm text-muted">
        <a href={`/p/${slug}`}>{listing.name}</a>
      </p>
      <h1 className="mt-1 text-[32px] font-semibold">Promote</h1>
      <p className="mt-3 max-w-[62ch]">
        Pay to place this listing in Promoted for 24 hours. A higher total payment ranks higher than a lower one.
      </p>
      {current ? (
        <p className="banner mt-4">
          Already promoted at {formatMoney(current.amountCents)} until{" "}
          {current.endsAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          Another payment adds to that total.
        </p>
      ) : null}
      {query.error ? <p className="banner mt-4">{query.error}</p> : null}
      {query.sent ? <p className="banner mt-4">The sign-in link is in the server console.</p> : null}
      <div className="mt-8 max-w-lg border-t border-line">
        {TIERS.map((tier) => (
          <div key={tier.id} className="flex items-baseline justify-between gap-4 border-b border-line py-4">
            <div>
              <p className="font-semibold">{tier.label}</p>
              <p className="text-sm text-muted">24 hours</p>
            </div>
            <p className="text-[20px] font-semibold tabular-nums">{formatMoney(tier.cents)}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-[62ch] text-sm text-muted">
        This server records the payment and does not charge a card.
      </p>
      {owns && listing.status === "published" ? (
        <form action={payForPromotion} className="mt-6 grid max-w-lg gap-3">
          <input type="hidden" name="slug" value={slug} />
          <fieldset className="grid gap-2">
            <legend className="text-sm text-muted">Choose a price</legend>
            {TIERS.map((tier) => (
              <label key={tier.id} className="flex items-center gap-3 text-ink">
                <input type="radio" name="tier" value={tier.id} defaultChecked={tier.id === "standard"} className="w-auto" />
                {tier.label} {formatMoney(tier.cents)}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="w-fit">
            Pay and promote
          </button>
        </form>
      ) : null}
      {!viewer ? (
        <form action={requestMagicLink} className="mt-6 grid max-w-md gap-3">
          <p>Sign in as @{listing.author.handle} to pay.</p>
          <input type="hidden" name="next" value={`/promote/${slug}`} />
          <label>
            Email
            <input name="email" type="email" required defaultValue={listing.author.email} />
          </label>
          <button type="submit" className="w-fit">
            Email me a link
          </button>
        </form>
      ) : null}
      {viewer && !owns ? <p className="mt-6">Signed in as @{viewer.handle}. Only @{listing.author.handle} can pay for this listing.</p> : null}
      {owns && listing.status !== "published" ? (
        <p className="mt-6">This listing is {listing.status}. It can be promoted after it is published.</p>
      ) : null}
    </>
  );
}
