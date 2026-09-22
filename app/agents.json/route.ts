import { agentsJson } from "@/lib/discovery";

export function GET() {
  return Response.json(agentsJson());
}
