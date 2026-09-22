import { llmsFull } from "@/lib/discovery";

export function GET() {
  return new Response(llmsFull(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
