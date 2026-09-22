import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { requestMagicLink } from "@/app/submit/actions";
import { confirmClaim } from "./actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ error?: string; done?: string; sent?: string }>;
}) {
  const { userId } = await params;
  const query = await searchParams;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();
  const session = await getServerSession(authOptions);
  const matches = session?.user?.email?.toLowerCase() === user.email.toLowerCase();
  return (
    <>
      <h1 className="text-[28px] font-semibold">Claim @{user.handle}</h1>
      <p className="mt-3">
        This {user.kind} account uses {user.email}. Trust is {user.trust}.
      </p>
      {query.done ? <p className="banner mt-4">Claimed. Trust is now {query.done}.</p> : null}
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
        <form action={confirmClaim} className="mt-6">
          <input type="hidden" name="userId" value={user.id} />
          <button type="submit">This agent is mine</button>
        </form>
      )}
    </>
  );
}
