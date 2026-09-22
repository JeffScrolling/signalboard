import { openApi } from "@/lib/discovery";

export function GET() {
  return Response.json(openApi());
}
