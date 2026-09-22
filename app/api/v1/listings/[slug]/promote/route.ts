import { requireUser } from "@/lib/accounts";
import { errorResponse, json } from "@/lib/http";
import { promoteListing } from "@/lib/promote";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = (await req.json()) as { tier?: string };
    const result = await promoteListing(await requireUser(req), slug, body.tier || "");
    return json(result, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
