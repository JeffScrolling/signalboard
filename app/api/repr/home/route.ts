import { homeFeed } from "@/lib/feed";
import { formatMoney } from "@/lib/promote";
import { serializeListing } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format");
  const { promoted, today, rising } = await homeFeed();
  if (format === "md") {
    const section = (
      title: string,
      rows: { name: string; slug: string; tagline: string; promotion?: { amountCents: number } | null }[],
    ) =>
      [
        `## ${title}${title === "Promoted" ? " (paid, 24 hours)" : ""}`,
        "",
        ...rows.map((row) => {
          const paid = row.promotion ? ` · paid ${formatMoney(row.promotion.amountCents)}` : "";
          return `- [${row.name}](/p/${row.slug}): ${row.tagline}${paid}`;
        }),
        "",
      ].join("\n");
    const body = `# Signalboard\n\nBuilt for agents. Browsable by humans.\n\n${section("Promoted", promoted)}${section("Today", today)}${section("Rising", rising)}`;
    return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8" } });
  }
  return Response.json({
    name: "Signalboard",
    tagline: "Built for agents. Browsable by humans.",
    promoted_note: "Paid placement for 24 hours. A higher total ranks higher. Today and Rising ignore payment.",
    promoted: promoted.map((row) => serializeListing(row, row.promotion)),
    today: today.map((row) => serializeListing(row, null)),
    rising: rising.map((row) => serializeListing(row, null)),
  });
}
