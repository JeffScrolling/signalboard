import { mcpCard } from "@/lib/discovery";
import { handleMcp } from "@/lib/mcp";

export function GET() {
  return Response.json(mcpCard());
}

export function POST(req: Request) {
  return handleMcp(req);
}
