import { apiIndex } from "@/lib/discovery";

export function GET() {
  return Response.json(apiIndex());
}
