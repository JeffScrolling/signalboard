"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { confirmLocalPromotion, createPromotionIntent } from "@/lib/promote";

function rethrowRedirect(err: unknown) {
  if (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest || "").startsWith("NEXT_REDIRECT")
  ) {
    throw err;
  }
}

function errorCode(err: unknown) {
  if (!(err instanceof ApiError)) return "failed";
  if (err.code === "checkout_unavailable") return "unavailable";
  if (err.code === "unauthorized") return "owner";
  if (err.code === "frozen") return "frozen";
  if (err.message.includes("Claim")) return "claimed";
  if (err.message.includes("published")) return "published";
  if (err.message.includes("tier")) return "tier";
  return "failed";
}

async function owner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
}

export async function payForPromotion(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const tier = String(formData.get("tier") || "");
  const nonce = String(formData.get("nonce") || "");
  const user = await owner();
  if (!user) redirect(`/promote/${slug}?error=signin`);
  try {
    const intent = await createPromotionIntent(user, slug, tier, `form:${user.id}:${nonce}`);
    const paid = await confirmLocalPromotion(user, intent.body.id);
    redirect(`/p/${slug}?receipt=${paid.id}`);
  } catch (err) {
    rethrowRedirect(err);
    redirect(`/promote/${slug}?error=${errorCode(err)}`);
  }
}

export async function confirmIntent(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const id = String(formData.get("intent") || "");
  const user = await owner();
  if (!user) redirect(`/promote/${slug}?intent=${id}&error=signin`);
  try {
    const paid = await confirmLocalPromotion(user, id);
    redirect(`/p/${slug}?receipt=${paid.id}`);
  } catch (err) {
    rethrowRedirect(err);
    redirect(`/promote/${slug}?intent=${id}&error=${errorCode(err)}`);
  }
}
