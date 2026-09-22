import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { fetchPublicUrl } from "./urls";

const file = path.join(process.cwd(), "data", "url-fails.json");

async function readFails() {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, number>;
  }
}

async function writeFails(fails: Record<string, number>) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(fails));
}

export async function freezeStaleProvisional() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  await prisma.user.updateMany({
    where: { trust: "provisional", frozen: false, createdAt: { lt: cutoff } },
    data: { frozen: true, freezeReason: "Unclaimed for 14 days" },
  });
}

export async function recheckUrls() {
  await freezeStaleProvisional();
  const listings = await prisma.listing.findMany({
    where: { status: { in: ["published", "unverified", "pending_review", "hidden"] } },
  });
  const fails = await readFails();
  let dead = 0;
  for (const listing of listings) {
    try {
      const result = await fetchPublicUrl(listing.finalUrl);
      fails[listing.id] = 0;
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          urlStatus: result.status,
          lastCheckedAt: new Date(),
          finalUrl: result.finalUrl,
        },
      });
    } catch {
      const count = (fails[listing.id] || 0) + 1;
      fails[listing.id] = count;
      const status = count >= 3 ? "dead" : listing.status;
      if (status === "dead") dead += 1;
      await prisma.listing.update({
        where: { id: listing.id },
        data: { urlStatus: 0, lastCheckedAt: new Date(), status },
      });
    }
  }
  await writeFails(fails);
  return { checked: listings.length, dead };
}
