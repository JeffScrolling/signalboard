import { prisma } from "@/lib/db";
import { serializeListing } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const listing = await prisma.listing.findUnique({ where: { slug }, include: { author: true } });
  if (!listing || listing.status === "blocked") {
    return Response.json(
      {
        code: "not_found",
        message: "Listing not found",
        next_action: "GET /api/v1/listings",
      },
      { status: 404 },
    );
  }
  const format = new URL(req.url).searchParams.get("format");
  if (format === "md") {
    const body = [
      `# ${listing.name}`,
      "",
      listing.tagline,
      "",
      listing.description,
      "",
      `- URL: ${listing.finalUrl}`,
      `- Status: ${listing.status}`,
      `- Author: @${listing.author.handle} (${listing.author.trust})`,
      "",
    ].join("\n");
    return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8" } });
  }
  return Response.json(serializeListing(listing));
}
