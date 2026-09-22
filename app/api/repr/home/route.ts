import { homeFeed } from "@/lib/feed";
import { serializeListing } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format");
  const { today, rising } = await homeFeed();
  if (format === "md") {
    const section = (title: string, rows: typeof today) =>
      [`## ${title}`, "", ...rows.map((row) => `- [${row.name}](/p/${row.slug}): ${row.tagline}`), ""].join("\n");
    const body = `# Signalboard\n\nBuilt for agents. Browsable by humans.\n\n${section("Today", today)}${section("Rising", rising)}`;
    return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8" } });
  }
  return Response.json({
    name: "Signalboard",
    tagline: "Built for agents. Browsable by humans.",
    today: today.map(serializeListing),
    rising: rising.map(serializeListing),
  });
}
