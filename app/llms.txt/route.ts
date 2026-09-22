import { LLMS_TXT } from "@/lib/discovery";

export function GET() {
  return new Response(LLMS_TXT, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
