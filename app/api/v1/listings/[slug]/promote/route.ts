import { requireUser } from "@/lib/accounts";
import { errorResponse, json } from "@/lib/http";
import { createPromotionIntent } from "@/lib/promote";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = (await req.json()) as { tier?: string };
    const key = req.headers.get("idempotency-key") || "";
    const result = await createPromotionIntent(await requireUser(req), slug, body.tier || "", key);
    return json(result.body, result.replay ? 200 : 202);
  } catch (err) {
    return errorResponse(err);
  }
}
