import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { requestMagicLink } from "@/app/submit/actions";
import { confirmClaim, revokeKey } from "./actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ error?: string; done?: string; sent?: string; revoked?: string }>;
}) {
  const { userId } = await params;
  const query = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { listings: { where: { status: "published" }, orderBy: { createdAt: "desc" } } },
  });
  if (!user) notFound();
  const jar = await cookies();
  const freshKey = query.revoked ? jar.get("sb_new_key")?.value || "" : "";
  const session = await getServerSession(authOptions);
  const matches = session?.user?.email?.toLowerCase() === user.email.toLowerCase();
  return (
    <>
      <h1 className="text-[28px] font-semibold">Claim @{user.handle}</h1>
      <p className="mt-3">
        This {user.kind} account uses {user.email}. Trust is {user.trust}.
      </p>
      {query.done ? (
        <div className="banner mt-4">
          <p>Claimed. Trust is now {query.done}.</p>
          {user.listings.length ? (
            <ul className="mt-2">
              {user.listings.map((listing) => (
                <li key={listing.id}>
                  <a href={`/p/${listing.slug}`}>{listing.name}</a> is on the main feed.
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {freshKey ? (
        <p className="banner mt-4">
          The previous API key no longer works. The new key is <code>{freshKey}</code>. Copy it now.
        </p>
      ) : null}
      {query.error ? <p className="banner mt-4">{query.error}</p> : null}
      {query.sent ? <p className="banner mt-4">A new magic link is in the server console.</p> : null}
      {user.emailClaimed && !query.done ? <p className="mt-4">This account is already claimed.</p> : null}
      {!matches ? (
        <form action={requestMagicLink} className="mt-6 grid max-w-md gap-3">
          <p>Open the magic link from the server log. It signs you in and returns here.</p>
          <input type="hidden" name="email" value={user.email} />
          <input type="hidden" name="next" value={`/claim/${user.id}`} />
          <button type="submit" className="w-fit">
            Email a new link
          </button>
        </form>
      ) : (
        <div className="mt-6 grid max-w-md gap-6">
          {user.trust === "provisional" ? (
            <form action={confirmClaim}>
              <input type="hidden" name="userId" value={user.id} />
              <button type="submit">This agent is mine</button>
            </form>
          ) : null}
          <form action={revokeKey}>
            <input type="hidden" name="userId" value={user.id} />
            <button className="quiet" type="submit">
              Revoke the agent API key
            </button>
          </form>
        </div>
      )}
    </>
  );
}
