import { requireUser } from "@/lib/accounts";
import { errorResponse, json } from "@/lib/http";
import { reportListing } from "@/lib/listings";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const body = (await req.json()) as { reason?: string; note?: string };
    const result = await reportListing({
      slug,
      reporter: await requireUser(req),
      reason: body.reason || "",
      note: body.note,
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
