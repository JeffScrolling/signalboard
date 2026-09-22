import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LINK =
  '</llms.txt>; rel="describedby", </.well-known/agent-card.json>; rel="agent-card", </mcp>; rel="mcp", </openapi.json>; rel="service-desc"';

function isDiscovery(pathname: string) {
  if (pathname.startsWith("/.well-known/")) return true;
  if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) return true;
  return [
    "/llms.txt",
    "/llms-full.txt",
    "/SKILL.md",
    "/agents.txt",
    "/agents.json",
    "/openapi.json",
    "/robots.txt",
    "/sitemap.xml",
    "/mcp",
  ].includes(pathname);
}

function negotiated(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format");
  if (format === "json") return "json";
  if (format === "md" || format === "markdown") return "md";
  const accept = (req.headers.get("accept") || "").toLowerCase();
  if (!accept) return null;
  const types = accept.split(",").map((part) => {
    const [mime, ...params] = part.trim().split(";");
    const qParam = params.map((item) => item.trim()).find((item) => item.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    return { mime: mime.trim(), q: Number.isFinite(q) ? q : 1 };
  });
  const rank = (mime: string) => types.find((type) => type.mime === mime)?.q ?? 0;
  const json = rank("application/json");
  const markdown = Math.max(rank("text/markdown"), rank("text/x-markdown"));
  const html = Math.max(rank("text/html"), rank("application/xhtml+xml"));
  const star = rank("*/*");
  if (json > html && json >= markdown && json >= star) return "json";
  if (markdown > html && markdown > json && markdown >= star) return "md";
  return null;
}

function withCors(res: NextResponse) {
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  res.headers.set("access-control-allow-headers", "content-type, authorization, accept, mcp-protocol-version");
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (req.method === "OPTIONS" && isDiscovery(pathname)) {
    return withCors(new NextResponse(null, { status: 204 }));
  }
  const format = negotiated(req);
  if ((pathname === "/" || pathname.startsWith("/p/")) && format && (req.method === "GET" || req.method === "HEAD")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/api/repr/home" : `/api/repr/listing/${pathname.slice(3)}`;
    url.searchParams.set("format", format);
    const res = NextResponse.rewrite(url);
    if (pathname === "/") res.headers.set("link", LINK);
    return res;
  }
  const res = NextResponse.next();
  if (pathname === "/") res.headers.set("link", LINK);
  if (isDiscovery(pathname)) withCors(res);
  return res;
}

export const config = {
  matcher: [
    "/",
    "/p/:path*",
    "/llms.txt",
    "/llms-full.txt",
    "/SKILL.md",
    "/agents.txt",
    "/agents.json",
    "/openapi.json",
    "/robots.txt",
    "/sitemap.xml",
    "/mcp",
    "/api/v1",
    "/api/v1/:path*",
    "/.well-known/:path*",
  ],
};
