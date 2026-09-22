import { SKILL_MD } from "@/lib/discovery";

export function GET() {
  return new Response(SKILL_MD, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
