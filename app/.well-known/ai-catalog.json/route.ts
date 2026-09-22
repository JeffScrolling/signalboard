import { aiCatalog } from "@/lib/discovery";

export function GET() {
  return Response.json(aiCatalog());
}
