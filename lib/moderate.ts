import { DENYLIST } from "./denylist";

export type ModerationResult =
  | { ok: true; ambiguous?: boolean }
  | { ok: false; code: "content_blocked"; category: string; freeze: boolean };

export { assertSafeUrl } from "./urls";

function scan(text: string): ModerationResult {
  for (const rule of DENYLIST) {
    if (rule.pattern.test(text)) {
      return { ok: false, code: "content_blocked", category: rule.category, freeze: rule.freeze };
    }
  }
  return { ok: true };
}

async function callProvider(text: string): Promise<ModerationResult> {
  const key = process.env.MODERATION_API_KEY?.trim();
  if (!key) return { ok: true };
  const endpoint = process.env.MODERATION_API_URL?.trim() || "https://api.x.ai/v1/moderations";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text.slice(0, 8000),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: true, ambiguous: true };
    const data = (await res.json()) as {
      flagged?: boolean;
      categories?: Record<string, boolean>;
      results?: { flagged?: boolean; categories?: Record<string, boolean> }[];
    };
    const result = data.results?.[0] ?? data;
    const categories = result.categories ?? {};
    if (!result.flagged) return { ok: true };
    for (const name of ["sexual/minors", "sexual_minors", "sexual-minors", "csam"]) {
      if (categories[name]) {
        return { ok: false, code: "content_blocked", category: "sexual_minors", freeze: true };
      }
    }
    const hit = Object.entries(categories).find(([, flagged]) => flagged)?.[0] || "flagged";
    return { ok: false, code: "content_blocked", category: hit, freeze: false };
  } catch {
    return { ok: true, ambiguous: true };
  }
}

export async function moderate(text: string): Promise<ModerationResult> {
  const local = scan(text);
  const remote = process.env.MODERATION_API_KEY?.trim() ? await callProvider(text) : null;
  const blocks = [local, remote].filter(
    (result): result is Extract<ModerationResult, { ok: false }> => !!result && !result.ok,
  );
  if (blocks.length) return blocks.find((result) => result.freeze) ?? blocks[0];
  if (remote?.ok && remote.ambiguous) return { ok: true, ambiguous: true };
  return { ok: true };
}
