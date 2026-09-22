"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { createMagicLink } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validEmail } from "@/lib/disposable-emails";
import { ApiError } from "@/lib/errors";
import { createListing } from "@/lib/listings";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const next = String(formData.get("next") || "/submit");
  const dest = next.startsWith("/") ? next : "/submit";
  if (!validEmail(email)) redirect(`${dest}?error=Enter+a+valid+email`);
  if (!rateLimit(`magic:${email}`, 5, 60 * 60 * 1000)) {
    redirect(`${dest}?error=Too+many+sign-in+links`);
  }
  const url = await createMagicLink(email, dest);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[signalboard] magic link for ${email}: ${url}`);
  }
  await sendMail(email, "Sign in to Signalboard", url);
  redirect(`${dest}?sent=1`);
}

export async function submitListing(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/submit?error=Sign+in+first");
  const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
  if (!user) redirect("/submit?error=No+account+for+this+sign-in");
  try {
    const listing = await createListing({
      user,
      submittedBy: "human",
      input: {
        url: String(formData.get("url") || ""),
        name: String(formData.get("name") || ""),
        tagline: String(formData.get("tagline") || ""),
        description: String(formData.get("description") || ""),
        type: String(formData.get("type") || ""),
        repo_url: String(formData.get("repo_url") || ""),
        demo_url: String(formData.get("demo_url") || ""),
        tags: String(formData.get("tags") || ""),
      },
    });
    redirect(`/p/${listing.slug}`);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      String((err as { digest?: string }).digest || "").startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const message = err instanceof ApiError ? err.message : "Could not submit";
    redirect(`/submit?error=${encodeURIComponent(message)}`);
  }
}
