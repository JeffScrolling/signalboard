import { getServerSession } from "next-auth";
import { claimAccount } from "@/lib/accounts";
import { authOptions } from "@/lib/auth";
import { errorResponse, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return json(
        {
          code: "unauthorized",
          message: "Sign in with the claim magic link first",
          next_action: "Open the magic link from the server console, then confirm.",
        },
        401,
      );
    }
    const body = (await req.json()) as { userId?: string; user_id?: string };
    const userId = body.userId || body.user_id || "";
    const result = await claimAccount(userId, session.user.email);
    return json({
      ok: true,
      trust: result.user.trust,
      handle: result.user.handle,
      published: result.published,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
