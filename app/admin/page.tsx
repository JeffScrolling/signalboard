import { getServerSession } from "next-auth";
import { blockDomain, freezeAccount, hideListing, recheckAction, restoreListing, takeOffPromoted } from "./actions";
import { formatMoney } from "@/lib/promote";
import { requestMagicLink } from "@/app/submit/actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminEmails } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; sent?: string }>;
}) {
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() || "";
  const allowed = Boolean(email && adminEmails().includes(email));
  if (!allowed) {
    return (
      <>
        <h1 className="text-[28px] font-semibold">Admin</h1>
        <p className="mt-3">This page is for operators.</p>
        {query.error ? <p className="banner mt-4">{query.error}</p> : null}
        {query.sent ? <p className="banner mt-4">The sign-in link is in the server console.</p> : null}
        <form action={requestMagicLink} className="mt-6 grid max-w-md gap-3">
          <input type="hidden" name="next" value="/admin" />
          <label>
            Email
            <input name="email" type="email" required defaultValue={email} />
          </label>
          <button type="submit" className="w-fit">
            Email me a link
          </button>
        </form>
      </>
    );
  }
  const paid = await prisma.promotion.findMany({
    where: { status: "paid", endsAt: { gt: new Date() } },
    include: { listing: true, payer: true },
    orderBy: { endsAt: "asc" },
  });
  const rows = await prisma.listing.findMany({
    where: { status: { in: ["pending_review", "hidden", "blocked"] } },
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });
  const lanes = ["pending_review", "hidden", "blocked"] as const;
  return (
    <>
      <h1 className="text-[28px] font-semibold">Admin</h1>
      {query.notice ? <p className="banner mt-4">{query.notice}</p> : null}
      {query.error ? <p className="banner mt-4">{query.error}</p> : null}
      <form action={recheckAction} className="mt-4">
        <button type="submit">Recheck URLs</button>
      </form>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Active paid placements</h2>
        {!paid.length ? <p className="mt-2 text-muted">No paid placements.</p> : null}
        {paid.length ? (
          <table className="mt-3">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Amount</th>
                <th>Ends</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paid.map((row) => (
                <tr key={row.id}>
                  <td>
                    <a href={`/p/${row.listing.slug}`}>{row.listing.name}</a>
                    <div className="text-sm text-muted">@{row.payer.handle}</div>
                  </td>
                  <td>{formatMoney(row.amountCents)}</td>
                  <td>{row.endsAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td>
                    <form action={takeOffPromoted}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="quiet" type="submit">
                        Take off Promoted
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <p className="mt-2 text-sm text-muted">Taking a listing off Promoted removes the rank. It does not send a card refund.</p>
      </section>
      {lanes.map((lane) => {
        const items = rows.filter((row) => row.status === lane);
        return (
          <section key={lane} className="mt-8">
            <h2 className="text-xl font-semibold">{lane.replace("_", " ")}</h2>
            {!items.length ? <p className="mt-2 text-muted">No listings in this lane.</p> : null}
            {items.length ? (
              <table className="mt-3">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Author</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((listing) => (
                    <tr key={listing.id}>
                      <td>
                        <a href={`/p/${listing.slug}`}>{listing.name}</a>
                        <div className="text-sm text-muted">{listing.finalUrl}</div>
                      </td>
                      <td>
                        @{listing.author.handle}
                        {listing.author.frozen ? ` frozen (${listing.author.freezeReason || "frozen"})` : ""}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <form action={hideListing}>
                            <input type="hidden" name="id" value={listing.id} />
                            <button className="quiet" type="submit">
                              Hide
                            </button>
                          </form>
                          <form action={restoreListing}>
                            <input type="hidden" name="id" value={listing.id} />
                            <button className="quiet" type="submit">
                              Restore
                            </button>
                          </form>
                          <form action={freezeAccount}>
                            <input type="hidden" name="id" value={listing.authorId} />
                            <input type="hidden" name="reason" value="Frozen from admin" />
                            <button className="quiet" type="submit">
                              Freeze account
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        );
      })}
      <form action={blockDomain} className="mt-10 grid max-w-md gap-3">
        <h2 className="text-xl font-semibold text-ink">Block a domain</h2>
        <label>
          Host
          <input name="host" required placeholder="example.net" />
        </label>
        <label>
          Reason
          <input name="reason" required />
        </label>
        <button type="submit" className="w-fit">
          Add domain block
        </button>
      </form>
    </>
  );
}
