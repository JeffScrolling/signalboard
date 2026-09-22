import { agentsTxt } from "@/lib/discovery";

export function GET() {
  return new Response(agentsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
