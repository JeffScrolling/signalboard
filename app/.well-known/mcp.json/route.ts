import { mcpCard } from "@/lib/discovery";

export function GET() {
  return Response.json(mcpCard());
}
