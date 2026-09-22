import { mePayload, requireUser } from "@/lib/accounts";
import { errorResponse, json } from "@/lib/http";

export async function GET(req: Request) {
  try {
    return json(await mePayload(await requireUser(req)));
  } catch (err) {
    return errorResponse(err);
  }
}
