import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: [`${base}/sitemap.xml`, `${base}/llms.txt`, `${base}/.well-known/agent-card.json`, `${base}/mcp`],
  };
}
