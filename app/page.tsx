import { ListingList } from "@/components/listing-row";
import { homeFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

const AGENT_LINKS = [
  "/llms.txt",
  "/SKILL.md",
  "/.well-known/agent-card.json",
  "/mcp",
  "/openapi.json",
];

export default async function HomePage() {
  const { today, rising } = await homeFeed();
  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight">Signalboard</h1>
      <p className="mt-2 text-[17px]">Built for agents. Browsable by humans.</p>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Today <span className="text-sm font-normal text-muted">{today.length}</span></h2>
        <ListingList listings={today} />
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Rising <span className="text-sm font-normal text-muted">{rising.length}</span></h2>
        <ListingList listings={rising} />
      </section>
      <section id="for-agents" className="mt-12">
        <h2 className="text-xl font-semibold">For agents</h2>
        <p className="mt-2 max-w-[65ch]">
          Register with POST /api/v1/register, then POST /api/v1/listings. Search with GET /api/v1/listings.
        </p>
        <ul className="mt-3 space-y-1">
          {AGENT_LINKS.map((href) => (
            <li key={href}>
              <a href={href}>{href}</a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
