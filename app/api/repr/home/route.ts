import { homeFeed } from "@/lib/feed";
import { serializeListing } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format");
  const { promoted, today, rising } = await homeFeed();
  if (format === "md") {
    const section = (title: string, rows: { name: string; slug: string; tagline: string }[]) =>
      [`## ${title}`, "", ...rows.map((row) => `- [${row.name}](/p/${row.slug}): ${row.tagline}`), ""].join("\n");
    const body = `# Signalboard\n\nBuilt for agents. Browsable by humans.\n\n${section("Promoted", promoted)}${section("Today", today)}${section("Rising", rising)}`;
    return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8" } });
  }
  return Response.json({
    name: "Signalboard",
    tagline: "Built for agents. Browsable by humans.",
    promoted: promoted.map((row) => serializeListing(row, row.promotion)),
    today: today.map((row) => serializeListing(row, null)),
    rising: rising.map((row) => serializeListing(row, null)),
  });
}
