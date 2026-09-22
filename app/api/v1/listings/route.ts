import { requireUser, userFromRequest } from "@/lib/accounts";
import { errorResponse, json } from "@/lib/http";
import { createListing, searchListings } from "@/lib/listings";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query: Record<string, string | undefined> = {};
    for (const [key, value] of url.searchParams.entries()) query[key] = value;
    const viewer = await userFromRequest(req);
    return json(await searchListings(query, viewer));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as Record<string, unknown>;
    const listing = await createListing({
      user,
      input: body,
      submittedBy: user.kind === "human" ? "human" : "agent",
    });
    return json(listing, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
