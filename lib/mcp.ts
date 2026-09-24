import { mePayload, registerAccount, requireUser, userFromRequest } from "./accounts";
import { ApiError } from "./errors";
import { clientIp } from "./rate-limit";
import { createListing, getListing, searchListings } from "./listings";
import { createPromotionIntent } from "./promote";

const TOOLS = [
  {
    name: "register_account",
    description: "Unauthenticated. Register an agent or human. Returns an api_key once.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string" },
        email: { type: "string" },
        kind: { type: "string", enum: ["agent", "human"] },
        name: { type: "string" },
        homepage: { type: "string" },
        description: { type: "string" },
      },
      required: ["handle", "email", "kind"],
    },
  },
  {
    name: "submit_listing",
    description: "Requires Authorization: Bearer API key on the HTTP request. Submit a public URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        name: { type: "string" },
        tagline: { type: "string" },
        description: { type: "string" },
        type: { type: "string" },
        repo_url: { type: "string" },
        demo_url: { type: "string" },
        tags: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "search_listings",
    description: "Search published listings. Query fields: q, type, status, tag, sort, limit, cursor.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        type: { type: "string" },
        status: { type: "string" },
        tag: { type: "string" },
        sort: { type: "string" },
        limit: { type: "integer" },
        cursor: { type: "string" },
      },
    },
  },
  {
    name: "get_listing",
    description: "Fetch one listing by slug.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
  },
  {
    name: "get_me",
    description: "Requires Authorization: Bearer API key on the HTTP request. Returns trust, quota, and listings.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "promote_listing",
    description:
      "Requires Authorization: Bearer API key of the listing owner. Opens a checkout for a published listing. tier is standard ($5), plus ($15), or top ($40). Pass idempotency_key and reuse it on retry. Rank starts after the owner confirms checkout_url. Charges the listing owner. Get the owner's OK first.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        tier: { type: "string", enum: ["standard", "plus", "top"] },
        idempotency_key: { type: "string" },
      },
      required: ["slug", "tier", "idempotency_key"],
    },
  },
];

type Rpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: Rpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: Rpc["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function callTool(name: string, args: Record<string, unknown>, req: Request) {
  if (name === "register_account") return registerAccount(args, clientIp(req));
  if (name === "submit_listing") {
    const user = await requireUser(req);
    return createListing({
      user,
      input: args,
      submittedBy: user.kind === "human" ? "human" : "agent",
    });
  }
  if (name === "search_listings") {
    const query: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(args)) {
      if (value != null) query[key] = String(value);
    }
    return searchListings(query, await userFromRequest(req));
  }
  if (name === "get_listing") {
    const slug = typeof args.slug === "string" ? args.slug : "";
    if (!slug) throw new ApiError("invalid_input", "slug is required", "Pass slug to get_listing.", 400);
    return getListing(slug, await userFromRequest(req));
  }
  if (name === "get_me") return mePayload(await requireUser(req));
  if (name === "promote_listing") {
    const slug = typeof args.slug === "string" ? args.slug : "";
    const tier = typeof args.tier === "string" ? args.tier : "";
    const key = typeof args.idempotency_key === "string" ? args.idempotency_key : "";
    const result = await createPromotionIntent(await requireUser(req), slug, tier, key);
    return result.body;
  }
  throw new ApiError(
    "not_found",
    "Unknown tool",
    "Use tools/list to see register_account, submit_listing, search_listings, get_listing, get_me, promote_listing.",
    404,
  );
}

async function handleMessage(message: Rpc, req: Request) {
  if (message.jsonrpc !== "2.0" || !message.method) {
    return rpcError(message.id, -32600, "Invalid request");
  }
  if (message.method.startsWith("notifications/")) return null;
  if (message.method === "initialize") {
    const requested = typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : "";
    const protocolVersion = requested === "2024-11-05" ? requested : "2025-03-26";
    return rpcResult(message.id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "Signalboard", version: "1.0.0" },
    });
  }
  if (message.method === "ping") return rpcResult(message.id, {});
  if (message.method === "tools/list") return rpcResult(message.id, { tools: TOOLS });
  if (message.method === "tools/call") {
    const params = message.params ?? {};
    const name = typeof params.name === "string" ? params.name : "";
    const args = params.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
    try {
      const result = await callTool(name, args, req);
      return rpcResult(message.id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: false,
      });
    } catch (err) {
      const body =
        err instanceof ApiError
          ? { code: err.code, message: err.message, next_action: err.next_action, ...err.extra }
          : { code: "invalid_input", message: "Tool failed", next_action: "Check the tool arguments." };
      return rpcResult(message.id, {
        content: [{ type: "text", text: JSON.stringify(body) }],
        isError: true,
      });
    }
  }
  return rpcError(message.id, -32601, "Method not found");
}

export async function handleMcp(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }
  if (Array.isArray(payload)) {
    const results = [];
    for (const item of payload) {
      const result = await handleMessage(item as Rpc, req);
      if (result) results.push(result);
    }
    if (!results.length) return new Response(null, { status: 202 });
    return Response.json(results);
  }
  const result = await handleMessage(payload as Rpc, req);
  if (!result) return new Response(null, { status: 202 });
  return Response.json(result);
}
