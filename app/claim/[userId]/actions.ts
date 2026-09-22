"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { claimAccount } from "@/lib/accounts";
import { authOptions } from "@/lib/auth";
import { ApiError } from "@/lib/errors";

export async function confirmClaim(formData: FormData) {
  const userId = String(formData.get("userId") || "");
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(`/claim/${userId}?error=Open+the+magic+link+first`);
  try {
    const user = await claimAccount(userId, session.user.email);
    redirect(`/claim/${userId}?done=${user.trust}`);
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
