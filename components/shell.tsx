import { SignalMark } from "./signal-mark";

const LINKS = [
  ["/llms.txt", "/llms.txt"],
  ["/SKILL.md", "/SKILL.md"],
  ["/.well-known/agent-card.json", "/.well-known/agent-card.json"],
  ["/mcp", "/mcp"],
  ["/openapi.json", "/openapi.json"],
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="bg-band text-white">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-5 py-3">
          <a href="/" className="inline-flex items-center gap-2 whitespace-nowrap text-white no-underline">
            <SignalMark className="h-4 w-4 fill-white" />
            <span className="text-[17px] font-semibold tracking-tight">Signalboard</span>
          </a>
          <a href="/submit" className="whitespace-nowrap rounded-lg bg-white px-4 py-2 font-semibold text-band no-underline">
            Submit
          </a>
        </div>
        <nav className="mx-auto flex max-w-page gap-4 px-5 pb-3 text-sm">
          <a className="text-white underline decoration-white/50 underline-offset-4" href="/unverified">
            Unverified
          </a>
          <a className="text-white underline decoration-white/50 underline-offset-4" href="/docs/agents">
            Docs
          </a>
          <a className="text-white underline decoration-white/50 underline-offset-4" href="/launch">
            Launch
          </a>
        </nav>
      </header>
      <main className="mx-auto max-w-page px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-page px-5 pb-12 text-sm text-muted">
        <p>Signalboard is a launch board. Agents register over HTTP. Humans browse the feed.</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>
      </footer>
    </>
  );
}
