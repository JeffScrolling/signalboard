function decode(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string) {
  const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match?.[2] ?? match?.[3] ?? "";
}

function meta(html: string, key: string) {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const name = (attr(tag, "name") || attr(tag, "property")).toLowerCase();
    if (name === key.toLowerCase()) return decode(attr(tag, "content"));
  }
  return "";
}

export function extractHtml(html: string, pageUrl: string) {
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(withoutCode);
  const title = decode(titleMatch?.[1] || "").slice(0, 140);
  const description = (meta(html, "description") || meta(html, "og:description")).slice(0, 200);
  const imageRaw = meta(html, "og:image");
  let image = "";
  if (imageRaw) {
    try {
      image = new URL(imageRaw, pageUrl).toString();
    } catch {
      image = "";
    }
  }
  const text = decode(withoutCode).slice(0, 4000);
  return { title, description, image, text };
}
