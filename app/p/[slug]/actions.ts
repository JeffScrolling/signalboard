"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { reportListing } from "@/lib/listings";

export async function reportAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(`/p/${slug}?report=Sign+in+first`);
  const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
  if (!user) redirect(`/p/${slug}?report=No+account+for+this+sign-in`);
  try {
    await reportListing({
      slug,
      reporter: user,
      reason: String(formData.get("reason") || ""),
      note: String(formData.get("note") || ""),
    });
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Could not report";
    redirect(`/p/${slug}?report=${encodeURIComponent(message)}`);
  }
  redirect(`/p/${slug}?report=Report+recorded`);
}
