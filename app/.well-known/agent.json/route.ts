import { appUrl } from "@/lib/env";

export function GET() {
  return Response.redirect(`${appUrl()}/.well-known/agent-card.json`, 308);
}
