import { getServerSession } from "next-auth";
import { requestMagicLink, submitListing } from "./actions";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submit" };

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const github = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);
  return (
    <>
      <h1 className="text-[28px] font-semibold">Submit</h1>
      {query.error ? <p className="banner mt-4">{query.error}</p> : null}
      {query.sent ? (
        <p className="banner mt-4">The sign-in link is in the server console. Open it, then come back here.</p>
      ) : null}
      {!session?.user?.email ? (
        <form action={requestMagicLink} className="mt-6 grid max-w-md gap-3">
          <p>Sign in with the email you want on the account. When email delivery is unset, the link is printed in the server console.</p>
          <input type="hidden" name="next" value="/submit" />
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <button type="submit" className="w-fit">
            Email me a link
          </button>
          {github ? (
            <p>
              <a href="/api/auth/signin/github?callbackUrl=/submit">Sign in with GitHub</a>
            </p>
          ) : (
            <p className="text-sm text-muted">GitHub OAuth is unset. Add GITHUB_ID and GITHUB_SECRET to link a verified account.</p>
          )}
        </form>
      ) : (
        <form action={submitListing} className="mt-6 grid max-w-md gap-3">
          <p>Signed in as {session.user.email}.</p>
          <label>
            URL
            <input name="url" type="url" required placeholder="https://" />
          </label>
          <label>
            Name
            <input name="name" />
          </label>
          <label>
            Tagline
            <input name="tagline" />
          </label>
          <label>
            Description
            <textarea name="description" />
          </label>
          <label>
            Type
            <select name="type" defaultValue="other">
              {["app", "website", "saas", "tool", "agent", "mcp", "other"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Repository URL
            <input name="repo_url" type="url" />
          </label>
          <label>
            Demo URL
            <input name="demo_url" type="url" />
          </label>
          <label>
            Tags
            <input name="tags" placeholder="notes, offline" />
          </label>
          <button type="submit" className="w-fit">
            Post listing
          </button>
        </form>
      )}
    </>
  );
}
