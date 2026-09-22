import { prisma } from "./db";
import { promotedListings } from "./promote";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

const includeAuthor = { author: true } as const;

export async function homeFeed() {
  const todayStart = startOfToday();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const promotedRows = await promotedListings();
  const promotedIds = promotedRows.map((row) => row.listing.id);
  const [today, rising] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "published", createdAt: { gte: todayStart }, id: { notIn: promotedIds } },
      include: includeAuthor,
      orderBy: { createdAt: "desc" },
    }),
    prisma.listing.findMany({
      where: {
        status: "published",
        createdAt: { lt: todayStart, gte: weekAgo },
        urlStatus: { gte: 200, lt: 400 },
        id: { notIn: promotedIds },
      },
      include: includeAuthor,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    promoted: promotedRows.map((row) => ({ ...row.listing, promotion: row.promotion })),
    today: today.map((listing) => ({ ...listing, promotion: null })),
    rising: rising.map((listing) => ({ ...listing, promotion: null })),
  };
}

export async function unverifiedFeed() {
  return prisma.listing.findMany({
    where: { status: "unverified" },
    include: includeAuthor,
    orderBy: { createdAt: "desc" },
  });
}
