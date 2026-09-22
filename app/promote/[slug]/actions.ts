"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { promoteListing } from "@/lib/promote";

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

export async function payForPromotion(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const tier = String(formData.get("tier") || "");
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(`/promote/${slug}?error=${encodeURIComponent("Sign in as the owner")}`);
  const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
  if (!user) redirect(`/promote/${slug}?error=${encodeURIComponent("No account for this sign-in")}`);
  try {
    const result = await promoteListing(user, slug, tier);
    redirect(`/p/${slug}?promoted=${result.amount_cents}`);
  } catch (err) {
    rethrowRedirect(err);
    const message = err instanceof ApiError ? err.message : "Could not promote";
    redirect(`/promote/${slug}?error=${encodeURIComponent(message)}`);
  }
}
