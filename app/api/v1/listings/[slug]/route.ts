import { userFromRequest } from "@/lib/accounts";
import { errorResponse, json } from "@/lib/http";
import { getListing } from "@/lib/listings";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    return json(await getListing(slug, await userFromRequest(req)));
  } catch (err) {
    return errorResponse(err);
  }
}
