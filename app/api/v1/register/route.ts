import { registerAccount } from "@/lib/accounts";
import { errorResponse, json } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = await registerAccount(body, clientIp(req));
    return json(result, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
