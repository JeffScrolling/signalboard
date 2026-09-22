import { requireUser, rotateKey } from "@/lib/accounts";
import { errorResponse, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    return json(await rotateKey(await requireUser(req)));
  } catch (err) {
    return errorResponse(err);
  }
}
