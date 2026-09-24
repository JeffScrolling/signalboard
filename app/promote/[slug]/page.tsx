import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { requestMagicLink } from "@/app/submit/actions";
import { confirmIntent, payForPromotion } from "./actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TIERS, checkoutMode, formatMoney, formatWindows, paidWindows } from "@/lib/promote";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  signin: "Sign in as the owner.",
  owner: "Only the owner can pay for this listing.",
  unavailable: "Checkout is not open on this server.",
  tier: "Choose standard, plus, or top.",
  published: "Only a published listing can be promoted.",
  frozen: "This account is frozen.",
  claimed: "Claim the account before paying.",
  failed: "Could not start checkout.",
};

export default async function PromoteListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; sent?: string; intent?: string }>;
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
  const windows = await paidWindows(listing.id);
  const intent = query.intent
    ? await prisma.promotion.findFirst({ where: { id: query.intent, listingId: listing.id } })
    : null;
  const open = checkoutMode() === "local";
  const nonce = randomBytes(16).toString("hex");
  const error = query.error ? ERRORS[query.error] || ERRORS.failed : "";
  return (
    <>
      <p className="text-sm text-muted">
        <a href={`/p/${slug}`}>{listing.name}</a>
      </p>
      <h1 className="mt-1 text-[32px] font-semibold">Promote</h1>
      <p className="mt-3 max-w-[62ch]">
        Pay to place this listing in Promoted for 24 hours. A higher total ranks higher than a lower one. Today and Rising stay in time order.
      </p>
      {windows.length ? <p className="banner mt-4">Paid placement · {formatWindows(windows)}.</p> : null}
      {error ? <p className="banner mt-4">{error}</p> : null}
      {query.sent ? <p className="banner mt-4">The sign-in link is in the server console.</p> : null}
      {!open ? <p className="banner mt-4">Checkout is not open on this server.</p> : null}
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
      {open && owns && listing.status === "published" && intent?.status === "pending" ? (
        <form action={confirmIntent} className="mt-6">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intent" value={intent.id} />
          <p className="mb-3">Confirm {formatMoney(intent.amountCents)} for 24 hours. No card is charged on this machine.</p>
          <button type="submit">Confirm {formatMoney(intent.amountCents)}</button>
        </form>
      ) : null}
      {open && owns && listing.status === "published" && intent?.status !== "pending" ? (
        <form action={payForPromotion} className="mt-6 grid max-w-lg gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="nonce" value={nonce} />
          <fieldset className="grid gap-2">
            <legend className="text-sm text-muted">Choose a price</legend>
            {TIERS.map((tier) => (
              <label key={tier.id} className="flex items-center gap-3 text-ink">
                <input type="radio" name="tier" value={tier.id} defaultChecked={tier.id === "standard"} />
                {tier.label} {formatMoney(tier.cents)}
              </label>
            ))}
          </fieldset>
          <p className="text-sm text-muted">No card is charged on this machine.</p>
          <button type="submit" className="w-fit">
            Pay and promote
          </button>
        </form>
      ) : null}
      {!viewer ? (
        <form action={requestMagicLink} className="mt-6 grid max-w-md gap-3">
          <p>Sign in as the owner to pay.</p>
          <input type="hidden" name="next" value={`/promote/${slug}${query.intent ? `?intent=${query.intent}` : ""}`} />
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <button type="submit" className="w-fit">
            Email me a link
          </button>
        </form>
      ) : null}
      {viewer && !owns ? <p className="mt-6">Signed in as @{viewer.handle}. Only the owner can pay for this listing.</p> : null}
      {owns && listing.status !== "published" ? (
        <p className="mt-6">This listing is {listing.status}. It can be promoted after it is published.</p>
      ) : null}
    </>
  );
}
