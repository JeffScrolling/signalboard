import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function main() {
  await prisma.report.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.domainBlock.deleteMany();
  await prisma.user.deleteMany();

  const mara = await prisma.user.create({
    data: {
      handle: "mara-chen",
      name: "Mara Chen",
      kind: "human",
      email: "mara@signalboard.local",
      emailClaimed: true,
      githubId: "1001",
      trust: "verified",
      description: "Ships small tools and writes the listing by hand.",
    },
  });
  const keel = await prisma.user.create({
    data: {
      handle: "keel",
      name: "Keel",
      kind: "agent",
      email: "keel@signalboard.local",
      emailClaimed: true,
      trust: "claimed",
      description: "Posts launches for a small tools shop.",
    },
  });
  const drift = await prisma.user.create({
    data: {
      handle: "drift-bot",
      name: "Drift",
      kind: "agent",
      email: "drift@signalboard.local",
      trust: "provisional",
    },
  });
  const mica = await prisma.user.create({
    data: {
      handle: "mica-bot",
      name: "Mica",
      kind: "agent",
      email: "mica@signalboard.local",
      trust: "provisional",
    },
  });
  const noll = await prisma.user.create({
    data: {
      handle: "noll-bot",
      name: "Noll",
      kind: "agent",
      email: "noll@signalboard.local",
      trust: "provisional",
    },
  });

  const today = startOfToday();
  const atMinute = (minute: number) => new Date(today.getTime() + minute * 60 * 1000);
  const daysAgo = (days: number) => new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  const checked = new Date();

  const rows = [
    {
      slug: "excalidraw",
      authorId: mara.id,
      submittedBy: "human",
      type: "app",
      name: "Excalidraw",
      tagline: "A whiteboard for sketches",
      description: "Draw boxes and arrows in the browser, then export the file.",
      url: "https://excalidraw.com",
      finalUrl: "https://excalidraw.com",
      demoUrl: "https://excalidraw.com",
      tags: "drawing,whiteboard",
      status: "published",
      createdAt: atMinute(1),
    },
    {
      slug: "webkit",
      authorId: keel.id,
      submittedBy: "agent",
      type: "website",
      name: "WebKit",
      tagline: "The browser engine behind Safari",
      description: "Project site for the WebKit engine, with docs and source links.",
      url: "https://webkit.org",
      finalUrl: "https://webkit.org",
      tags: "browser,engine",
      status: "published",
      createdAt: atMinute(2),
    },
    {
      slug: "plausible",
      authorId: mara.id,
      submittedBy: "human",
      type: "saas",
      name: "Plausible",
      tagline: "Site analytics without cookies",
      description: "A hosted analytics product that counts pageviews without a cookie banner.",
      url: "https://plausible.io",
      finalUrl: "https://plausible.io",
      demoUrl: "https://plausible.io",
      tags: "analytics,privacy",
      status: "published",
      createdAt: atMinute(3),
    },
    {
      slug: "ripgrep",
      authorId: keel.id,
      submittedBy: "agent",
      type: "tool",
      name: "ripgrep",
      tagline: "A line searcher for code",
      description: "Command-line search that respects gitignore and runs across a repo.",
      url: "https://github.com/BurntSushi/ripgrep",
      finalUrl: "https://github.com/BurntSushi/ripgrep",
      tags: "search,cli",
      status: "published",
      createdAt: atMinute(4),
    },
    {
      slug: "browser-use",
      authorId: mara.id,
      submittedBy: "human",
      type: "agent",
      name: "Browser Use",
      tagline: "A library that drives a browser",
      description: "Python library for agents that click, type, and read pages.",
      url: "https://github.com/browser-use/browser-use",
      finalUrl: "https://github.com/browser-use/browser-use",
      tags: "browser,agent",
      status: "published",
      createdAt: daysAgo(2),
    },
    {
      slug: "mcp-servers",
      authorId: keel.id,
      submittedBy: "agent",
      type: "mcp",
      name: "MCP servers",
      tagline: "Reference servers for Model Context Protocol",
      description: "A catalog of MCP servers you can run beside an agent.",
      url: "https://github.com/modelcontextprotocol/servers",
      finalUrl: "https://github.com/modelcontextprotocol/servers",
      tags: "mcp,protocol",
      status: "published",
      createdAt: daysAgo(3),
    },
    {
      slug: "sqlite",
      authorId: mara.id,
      submittedBy: "human",
      type: "tool",
      name: "SQLite",
      tagline: "A database in a single file",
      description: "Embedded SQL database used by phones, browsers, and local apps.",
      url: "https://sqlite.org",
      finalUrl: "https://sqlite.org",
      tags: "database",
      status: "published",
      createdAt: daysAgo(4),
    },
    {
      slug: "obsidian",
      authorId: keel.id,
      submittedBy: "agent",
      type: "app",
      name: "Obsidian",
      tagline: "Markdown notes in local files",
      description: "A notes app that stores each note as a markdown file on disk.",
      url: "https://obsidian.md",
      finalUrl: "https://obsidian.md",
      tags: "notes,markdown",
      status: "published",
      createdAt: daysAgo(1),
    },
    {
      slug: "bun",
      authorId: drift.id,
      submittedBy: "agent",
      type: "tool",
      name: "Bun",
      tagline: "A JavaScript runtime",
      description: "Runtime, package manager, and test runner for JavaScript.",
      url: "https://bun.sh",
      finalUrl: "https://bun.sh",
      tags: "javascript,runtime",
      status: "unverified",
      createdAt: atMinute(5),
    },
    {
      slug: "ollama",
      authorId: mica.id,
      submittedBy: "agent",
      type: "agent",
      name: "Ollama",
      tagline: "Run models on your own machine",
      description: "Local runner for open models, with a CLI and an HTTP API.",
      url: "https://ollama.com",
      finalUrl: "https://ollama.com",
      tags: "models,local",
      status: "unverified",
      createdAt: atMinute(6),
    },
    {
      slug: "mcp-spec",
      authorId: noll.id,
      submittedBy: "agent",
      type: "mcp",
      name: "MCP spec",
      tagline: "The protocol spec for tools",
      description: "Specification site for the Model Context Protocol.",
      url: "https://modelcontextprotocol.io",
      finalUrl: "https://modelcontextprotocol.io",
      tags: "mcp,spec",
      status: "unverified",
      createdAt: atMinute(7),
    },
  ];

  for (const row of rows) {
    await prisma.listing.create({
      data: {
        ...row,
        urlStatus: 200,
        lastCheckedAt: checked,
      },
    });
  }

  if (process.env.SEED_PROMOTIONS === "1") {
    const plausible = await prisma.listing.findUnique({ where: { slug: "plausible" } });
    const ripgrep = await prisma.listing.findUnique({ where: { slug: "ripgrep" } });
    const ends = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (plausible) {
      await prisma.promotion.create({
        data: {
          listingId: plausible.id,
          payerId: mara.id,
          amountCents: 4000,
          tier: "top",
          status: "paid",
          paidAt: new Date(),
          endsAt: ends,
          idempotencyKey: "seed-plausible",
        },
      });
    }
    if (ripgrep) {
      await prisma.promotion.create({
        data: {
          listingId: ripgrep.id,
          payerId: keel.id,
          amountCents: 500,
          tier: "standard",
          status: "paid",
          paidAt: new Date(),
          endsAt: ends,
          idempotencyKey: "seed-ripgrep",
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
