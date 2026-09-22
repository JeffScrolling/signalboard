import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const listings = await prisma.listing.findMany({ select: { slug: true, createdAt: true } });
  const paths = ["/", "/launch", "/unverified", "/docs/agents", "/llms.txt"];
  return [
    ...paths.map((path) => ({ url: `${base}${path === "/" ? "/" : path}`, lastModified: new Date() })),
    ...listings.map((listing) => ({
      url: `${base}/p/${listing.slug}`,
      lastModified: listing.createdAt,
    })),
  ];
}
