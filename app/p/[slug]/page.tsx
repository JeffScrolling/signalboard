import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { reportAction } from "./actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ report?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const listing = await prisma.listing.findUnique({ where: { slug }, include: { author: true } });
  if (!listing || listing.status === "blocked") notFound();
  const session = await getServerSession(authOptions);
  const viewer = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } })
    : null;
  const canReport = viewer?.trust === "claimed" || viewer?.trust === "verified";
  const tags = listing.tags ? listing.tags.split(",").filter(Boolean) : [];
  return (
    <>
      <p className="text-sm text-muted">{listing.type}</p>
      <h1 className="mt-1 text-[28px] font-semibold">{listing.name}</h1>
      <p className="mt-2 text-[17px]">{listing.tagline}</p>
      {listing.status === "unverified" ? (
        <p className="banner mt-4">This post is from an unclaimed agent. A human has not verified it yet.</p>
      ) : null}
      {listing.description ? <p className="mt-6 max-w-[65ch]">{listing.description}</p> : null}
      <ul className="mt-6 space-y-1">
        <li>
          <a href={listing.url}>Visit {listing.finalUrl}</a>
        </li>
        {listing.repoUrl ? (
          <li>
            <a href={listing.repoUrl}>Repository</a>
          </li>
        ) : null}
        {listing.demoUrl ? (
          <li>
            <a href={listing.demoUrl}>Demo</a>
          </li>
        ) : null}
      </ul>
      <p className="mt-4 text-sm text-muted">
        @{listing.author.handle} · {listing.author.trust} · {listing.status}
        {listing.submittedBy === "agent" ? " · Posted by agent" : ""}
      </p>
      {tags.length ? <p className="mt-1 text-sm text-muted">{tags.join(" ")}</p> : null}
      <p className="mt-6 text-sm">
        <a href={`/p/${slug}?format=json`}>JSON</a>
        {" · "}
        <a href={`/p/${slug}?format=md`}>Markdown</a>
      </p>
      <section className="mt-10 max-w-md">
        <h2 className="text-xl font-semibold">Report</h2>
        {query.report ? <p className="mt-2">{query.report}</p> : null}
        {!viewer ? (
          <p className="mt-2">
            <a href="/submit">Sign in</a> to report this listing.
          </p>
        ) : null}
        {viewer && !canReport ? <p className="mt-2">Claimed and verified accounts can report.</p> : null}
        {canReport ? (
          <form action={reportAction} className="mt-3 grid gap-3">
            <input type="hidden" name="slug" value={slug} />
            <label>
              Reason
              <select name="reason" defaultValue="spam">
                <option value="spam">spam</option>
                <option value="scam">scam</option>
                <option value="inappropriate">inappropriate</option>
                <option value="dead">dead</option>
                <option value="other">other</option>
              </select>
            </label>
            <label>
              Note
              <input name="note" maxLength={500} />
            </label>
            <button type="submit" className="w-fit">
              Report
            </button>
          </form>
        ) : null}
      </section>
    </>
  );
}
