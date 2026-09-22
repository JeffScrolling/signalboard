import { lookup } from "dns/promises";
import { isIP } from "net";
import { prisma } from "./db";
import { ApiError } from "./errors";

const SHORTENERS = new Set([
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
  "shorturl.at",
  "tiny.cc",
  "rb.gy",
  "rebrand.ly",
]);

function httpAllowed() {
  return process.env.NODE_ENV !== "production";
}

export function isShortenerHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (SHORTENERS.has(host)) return true;
  for (const name of SHORTENERS) {
    if (host.endsWith(`.${name}`)) return true;
  }
  return false;
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIp(address: string) {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip === "::" || ip === "::1") return true;
  if (ip.startsWith("::ffff:")) {
    const mapped = ip.slice("::ffff:".length);
    if (isPrivateIpv4(mapped)) return true;
    if (isIP(mapped) === 4) return false;
  }
  if (ip.includes(":")) {
    const first = Number.parseInt(ip.split(":")[0] || "0", 16);
    if (Number.isNaN(first)) return true;
    if (first >= 0xfc00 && first <= 0xfdff) return true;
    if (first >= 0xfe80 && first <= 0xfebf) return true;
    return false;
  }
  return isPrivateIpv4(ip);
}

function forbidden(message: string) {
  return new ApiError(
    "url_forbidden",
    message,
    "Use a public https URL. Local, private, and non-http schemes are rejected.",
    403,
  );
}

function unreachable(message: string) {
  return new ApiError(
    "url_unreachable",
    message,
    "Check that the URL is public and responds within 5 seconds.",
    422,
  );
}

export function assertUrlSyntax(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError(
      "invalid_input",
      "URL is not absolute",
      "Send an absolute https URL.",
      400,
    );
  }
  if (url.username || url.password) throw forbidden("URL credentials are not allowed");
  if (url.protocol === "http:" && !httpAllowed()) {
    throw forbidden("http URLs are only allowed in development");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw forbidden("Only https URLs are allowed");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw forbidden("URL has no host");
  if (/^\d+$/.test(host)) throw forbidden("Numeric hostnames are not allowed");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw forbidden("Local hostnames are not allowed");
  }
  if (isIP(host) && isPrivateIp(host)) throw forbidden("Private network addresses are not allowed");
  return url;
}

async function assertHostAllowed(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const labels = host.split(".");
  for (let i = 0; i < labels.length - 1; i += 1) {
    const candidate = labels.slice(i).join(".");
    if (!candidate.includes(".")) continue;
    const block = await prisma.domainBlock.findUnique({ where: { host: candidate } });
    if (block) {
      throw new ApiError(
        "url_forbidden",
        `Host ${host} is blocked`,
        "Use a different URL. This domain is on the block list.",
        403,
      );
    }
  }
}

export async function assertSafeUrl(input: string) {
  const url = assertUrlSyntax(input);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(host)) return url;
  try {
    const records = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("dns timeout")), 5000);
      }),
    ]);
    if (!records.length) throw unreachable("Could not resolve host");
    for (const record of records) {
      if (isPrivateIp(record.address)) throw forbidden("Host resolves to a private address");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw unreachable("Could not resolve host");
  }
  return url;
}

export function normalizeUrl(input: string) {
  const url = new URL(input);
  url.hash = "";
  const protocol = url.protocol.toLowerCase();
  const host = url.host.toLowerCase().replace(/:443$/, "").replace(/:80$/, "");
  let path = url.pathname.replace(/\/+$/, "");
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const search = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${protocol}//${host}${path}${search}`;
}

async function readCap(res: Response, max: number) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const room = max - total;
    if (value.byteLength > room) {
      chunks.push(value.slice(0, room));
      total += room;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function fetchPublicUrl(raw: string) {
  let current = raw;
  let hops = 0;
  while (true) {
    const safe = await assertSafeUrl(current);
    await assertHostAllowed(safe.hostname);
    let res: Response;
    try {
      res = await fetch(safe.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: {
          "user-agent": "Signalboard/1.0",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
      });
    } catch {
      throw unreachable("Could not fetch the URL");
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      hops += 1;
      await res.body?.cancel();
      if (hops > 3) throw unreachable("Too many redirects");
      current = new URL(location, safe).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 400) {
      await res.body?.cancel();
      throw unreachable(`URL returned ${res.status}`);
    }
    const html = await readCap(res, 1_000_000);
    return {
      finalUrl: normalizeUrl(safe.toString()),
      status: res.status,
      html,
      contentType: res.headers.get("content-type") || "",
    };
  }
}
