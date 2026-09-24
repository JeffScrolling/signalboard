"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminEmails } from "@/lib/env";
import { recheckUrls } from "@/lib/maintenance";
import { voidPromotion } from "@/lib/promote";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() || "";
  if (!email || !adminEmails().includes(email)) redirect("/admin?error=Operators+only");
  return email;
}

export async function hideListing(formData: FormData) {
  await requireAdmin();
  await prisma.listing.update({
    where: { id: String(formData.get("id") || "") },
    data: { status: "hidden" },
  });
  redirect("/admin?notice=Hidden");
}

export async function restoreListing(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const listing = await prisma.listing.findUnique({ where: { id }, include: { author: true } });
  if (!listing) redirect("/admin?error=Missing+listing");
  const status = listing.author.trust === "provisional" ? "unverified" : "published";
  await prisma.listing.update({ where: { id }, data: { status } });
  redirect("/admin?notice=Restored");
}

export async function freezeAccount(formData: FormData) {
  await requireAdmin();
  const reason = String(formData.get("reason") || "Frozen by operator").slice(0, 200);
  await prisma.user.update({
    where: { id: String(formData.get("id") || "") },
    data: { frozen: true, freezeReason: reason },
  });
  redirect("/admin?notice=Account+frozen");
}

export async function blockDomain(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("host") || "").trim().toLowerCase();
  let host = raw;
  try {
    if (raw.includes("://")) host = new URL(raw).hostname;
  } catch {
    host = raw.replace(/\/.*$/, "").replace(/^\*\./, "");
  }
  host = host.replace(/\.$/, "");
  if (!host || !host.includes(".")) redirect("/admin?error=Enter+a+hostname");
  const reason = String(formData.get("reason") || "operator block").slice(0, 200);
  await prisma.domainBlock.upsert({
    where: { host },
    update: { reason },
    create: { host, reason },
  });
  redirect("/admin?notice=Domain+blocked");
}

export async function takeOffPromoted(formData: FormData) {
  await requireAdmin();
  await voidPromotion(String(formData.get("id") || ""));
  redirect("/admin?notice=Removed+from+Promoted");
}

export async function recheckAction() {
  await requireAdmin();
  const result = await recheckUrls();
  redirect(`/admin?notice=${encodeURIComponent(`Rechecked ${result.checked}. Marked dead: ${result.dead}.`)}`);
}
