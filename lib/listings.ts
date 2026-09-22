import type { Prisma, User } from "@prisma/client";
import { randomBytes } from "crypto";
import { assertCanPost } from "./accounts";
import { prisma } from "./db";
import { ApiError } from "./errors";
import { extractHtml } from "./extract";
import { moderate } from "./moderate";
import { promotionSummaries } from "./promote";
import { serializeListing, type ListingJson } from "./serialize";
import { assertSafeUrl, assertUrlSyntax, fetchPublicUrl, isShortenerHost, normalizeUrl } from "./urls";

const TYPES = ["app", "website", "saas", "tool", "agent", "mcp", "other"] as const;
const STATUSES = ["published", "unverified", "pending_review", "hidden", "dead", "blocked"] as const;
const REASONS = ["spam", "scam", "inappropriate", "dead", "other"] as const;

export type ListingInput = {
  url?: unknown;
  name?: unknown;
  tagline?: unknown;
  description?: unknown;
  type?: unknown;
  repo_url?: unknown;
  demo_url?: unknown;
  tags?: unknown;
};

function optionalText(value: unknown, field: string, max: number) {
  if (value == null) return undefined;
  if (typeof value !== "string") {
    throw new ApiError("invalid_input", `${field} must be a string`, `Send ${field} as a string or omit it.`, 400);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    throw new ApiError("invalid_input", `${field} is too long`, `Keep ${field} under ${max} characters.`, 400);
  }
  return trimmed;
}

function normalizeTags(value: unknown) {
  if (value == null || value === "") return "";
  const raw = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(",") : null;
  if (!raw) {
    throw new ApiError("invalid_input", "tags must be a string or array", "Send tags as a comma-separated string.", 400);
  }
  const tags = raw
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean)
    .slice(0, 8);
  for (const tag of tags) {
    if (!/^[a-z0-9-]{1,24}$/.test(tag)) {
      throw new ApiError("invalid_input", `Tag "${tag}" is not allowed`, "Use short lowercase tags: letters, digits, hyphens.", 400);
    }
  }
  return tags.join(",");
}

async function optionalUrl(value: unknown, field: string) {
  const text = optionalText(value, field, 2000);
  if (!text) return null;
  try {
    assertUrlSyntax(text);
  } catch (err) {
    if (err instanceof ApiError && err.code === "invalid_input") {
      throw new ApiError("invalid_input", `${field} is not a valid URL`, `Send an absolute https URL for ${field}, or omit it.`, 400);
    }
    throw new ApiError("invalid_input", `${field} is not allowed`, `Send a public https URL for ${field}, or omit it.`, 400);
  }
  return text;
}

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "listing";
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; i < 20; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const found = await prisma.listing.findUnique({ where: { slug } });
    if (!found) return slug;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function createListing(opts: {
  user: User;
  input: ListingInput;
  submittedBy: "agent" | "human";
}): Promise<ListingJson> {
  const { user, input } = opts;
  await assertCanPost(user);
  const rawUrl = optionalText(input.url, "url", 2000);
  if (!rawUrl) {
    throw new ApiError("invalid_input", "url is required", 'POST /api/v1/listings with { "url": "https://…" }.', 400);
  }
  const typeText = optionalText(input.type, "type", 32) ?? "other";
  if (!TYPES.includes(typeText as (typeof TYPES)[number])) {
    throw new ApiError(
      "invalid_input",
      "type is not recognized",
      "Use type app, website, saas, tool, agent, mcp, or other.",
      400,
    );
  }
  const nameInput = optionalText(input.name, "name", 120);
  const taglineInput = optionalText(input.tagline, "tagline", 180);
  const descriptionInput = optionalText(input.description, "description", 8000) ?? "";
  const repoUrl = await optionalUrl(input.repo_url, "repo_url");
  const demoUrl = await optionalUrl(input.demo_url, "demo_url");
  const tags = normalizeTags(input.tags);

  let parsed: URL;
  try {
    parsed = await assertSafeUrl(rawUrl);
  } catch (err) {
    if (err instanceof ApiError && err.code === "invalid_input") {
      throw new ApiError("invalid_input", "url is not absolute", "Send an absolute https URL.", 400);
    }
    throw err;
  }

  const fetched = await fetchPublicUrl(parsed.toString());
  const finalHost = new URL(fetched.finalUrl).hostname;
  if (isShortenerHost(parsed.hostname) && isShortenerHost(finalHost)) {
    throw new ApiError(
      "url_forbidden",
      "Shortener did not resolve to an allowed URL",
      "Submit the destination https URL instead of a short link.",
      403,
    );
  }
  const finalUrl = normalizeUrl(fetched.finalUrl);
  const duplicate = await prisma.listing.findFirst({ where: { finalUrl } });
  if (duplicate) {
    throw new ApiError(
      "duplicate_url",
      "A listing already uses this URL",
      `GET /api/v1/listings/${duplicate.slug}`,
      409,
      { slug: duplicate.slug },
    );
  }

  const extracted = extractHtml(fetched.html, finalUrl);
  const name = nameInput || extracted.title || finalHost;
  const tagline = taglineInput || extracted.description || name;
  let logoUrl: string | null = null;
  if (extracted.image) {
    try {
      assertUrlSyntax(extracted.image);
      logoUrl = extracted.image;
    } catch {
      logoUrl = null;
    }
  }
  const moderated = await moderate(
    [name, tagline, descriptionInput, extracted.text.slice(0, 4000)].filter(Boolean).join("\n"),
  );
  if (!moderated.ok) {
    if (moderated.freeze) {
      await prisma.user.update({
        where: { id: user.id },
        data: { frozen: true, freezeReason: moderated.category },
      });
    }
    throw new ApiError(
      "content_blocked",
      `Listing blocked (${moderated.category})${moderated.freeze ? ". The account is frozen." : ""}`,
      "Change the name, tagline, description, or URL. Do not retry the same payload.",
      422,
    );
  }

  let status = "unverified";
  if (user.trust === "claimed" || user.trust === "verified") {
    status = moderated.ambiguous ? "pending_review" : "published";
  }
  const listing = await prisma.listing.create({
    data: {
      slug: await uniqueSlug(name),
      authorId: user.id,
      submittedBy: opts.submittedBy,
      type: typeText,
      name: name.slice(0, 120),
      tagline: tagline.slice(0, 180),
      description: descriptionInput,
      url: rawUrl,
      finalUrl,
      repoUrl,
      demoUrl,
      logoUrl,
      tags,
      status,
      urlStatus: fetched.status,
      lastCheckedAt: new Date(),
    },
    include: { author: true },
  });
  return serializeListing(listing);
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}\n${id}`).toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("\n");
    const createdAt = new Date(iso || "");
    if (!id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function searchListings(query: Record<string, string | undefined>, viewer: User | null) {
  const sort = query.sort || "new";
  if (sort !== "new" && sort !== "rising") {
    throw new ApiError("invalid_input", "sort must be new or rising", "Use sort=new or sort=rising.", 400);
  }
  const requested = query.status || "published";
  if (!STATUSES.includes(requested as (typeof STATUSES)[number])) {
    throw new ApiError("invalid_input", "status is not recognized", `Use one of: ${STATUSES.join(", ")}.`, 400);
  }
  if (query.type && !TYPES.includes(query.type as (typeof TYPES)[number])) {
    throw new ApiError("invalid_input", "type is not recognized", "Use type app, website, saas, tool, agent, mcp, or other.", 400);
  }
  const limitRaw = query.limit ? Number(query.limit) : 20;
  if (!Number.isInteger(limitRaw) || limitRaw < 1) {
    throw new ApiError("invalid_input", "limit must be a positive integer", "Use limit between 1 and 50.", 400);
  }
  const limit = Math.min(limitRaw, 50);
  let cursor: { createdAt: Date; id: string } | null = null;
  if (query.cursor) {
    cursor = decodeCursor(query.cursor);
    if (!cursor) throw new ApiError("invalid_input", "cursor is not valid", "Use next_cursor from the previous page.", 400);
  }

  const and: Prisma.ListingWhereInput[] = [];
  if (!viewer || requested === "published") and.push({ status: "published" });
  else and.push({ status: requested, authorId: viewer.id });
  if (query.q) {
    const q = query.q.slice(0, 80);
    and.push({
      OR: [
        { name: { contains: q } },
        { tagline: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q.toLowerCase() } },
      ],
    });
  }
  if (query.type) and.push({ type: query.type });
  if (query.tag) and.push({ tags: { contains: query.tag.toLowerCase().slice(0, 24) } });
  if (sort === "rising") {
    and.push({ urlStatus: { gte: 200, lt: 400 } });
    and.push({ createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
  }
  if (cursor) {
    and.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
      ],
    });
  }

  const rows = await prisma.listing.findMany({
    where: { AND: and },
    include: { author: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const promos = await promotionSummaries(page.map((row) => row.id));
  return {
    listings: page.map((row) => serializeListing(row, promos.get(row.id) ?? null)),
    next_cursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

export async function getListing(slug: string, viewer?: User | null) {
  const listing = await prisma.listing.findUnique({ where: { slug }, include: { author: true } });
  if (!listing || (listing.status === "blocked" && viewer?.id !== listing.authorId)) {
    throw new ApiError("not_found", "Listing not found", "GET /api/v1/listings to browse published posts.", 404);
  }
  const promo = (await promotionSummaries([listing.id])).get(listing.id) ?? null;
  return serializeListing(listing, promo);
}

export async function reportListing(opts: { slug: string; reporter: User; reason: string; note?: string }) {
  if (opts.reporter.frozen) {
    throw new ApiError("frozen", "This account is frozen", "Frozen accounts cannot report.", 403);
  }
  if (opts.reporter.trust !== "claimed" && opts.reporter.trust !== "verified") {
    throw new ApiError(
      "unauthorized",
      "Reports require a claimed or verified account",
      "Claim the account, then report again.",
      401,
    );
  }
  if (!REASONS.includes(opts.reason as (typeof REASONS)[number])) {
    throw new ApiError(
      "invalid_input",
      "reason is not recognized",
      "Use reason spam, scam, inappropriate, dead, or other.",
      400,
    );
  }
  const listing = await prisma.listing.findUnique({ where: { slug: opts.slug } });
  if (!listing || listing.status === "blocked") {
    throw new ApiError("not_found", "Listing not found", "Check the slug and try again.", 404);
  }
  const note = opts.note?.trim().slice(0, 500);
  const reason = note ? `${opts.reason}: ${note}` : opts.reason;
  try {
    await prisma.report.create({
      data: { listingId: listing.id, reporterId: opts.reporter.id, reason },
    });
  } catch {
    throw new ApiError("invalid_input", "You already reported this listing", "No further report is needed.", 400);
  }
  const reports = await prisma.report.findMany({
    where: { listingId: listing.id },
    include: { reporter: true },
  });
  const trusted = new Set(
    reports
      .filter((report) => report.reporter.trust === "claimed" || report.reporter.trust === "verified")
      .map((report) => report.reporterId),
  );
  let status = listing.status;
  if (trusted.size >= 3 && status !== "blocked") {
    status = "hidden";
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "hidden" } });
  }
  return { ok: true, status, reports: trusted.size };
}
