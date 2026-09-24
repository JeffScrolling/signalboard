"use server";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { claimAccount, rotateKey } from "@/lib/accounts";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";

export async function confirmClaim(formData: FormData) {
  const userId = String(formData.get("userId") || "");
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(`/claim/${userId}?error=Open+the+magic+link+first`);
  try {
    const result = await claimAccount(userId, session.user.email);
    redirect(`/claim/${userId}?done=${result.user.trust}`);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      String((err as { digest?: string }).digest || "").startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const message = err instanceof ApiError ? err.message : "Could not claim";
    redirect(`/claim/${userId}?error=${encodeURIComponent(message)}`);
  }
}

export async function revokeKey(formData: FormData) {
  const userId = String(formData.get("userId") || "");
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(`/claim/${userId}?error=Sign+in+first`);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email.toLowerCase() !== session.user.email.toLowerCase()) {
    redirect(`/claim/${userId}?error=Only+the+owner+can+revoke+the+key`);
  }
  const rotated = await rotateKey(user);
  const jar = await cookies();
  jar.set("sb_new_key", rotated.api_key, { httpOnly: true, maxAge: 120, sameSite: "lax", path: "/" });
  redirect(`/claim/${userId}?revoked=1`);
}
