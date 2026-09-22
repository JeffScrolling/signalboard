import { agentCard } from "@/lib/discovery";

export function GET() {
  return Response.json(agentCard());
}
