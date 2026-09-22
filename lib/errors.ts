const STATUS: Record<string, number> = {
  invalid_input: 400,
  handle_taken: 409,
  email_blocked: 400,
  rate_limited: 429,
  unauthorized: 401,
  frozen: 403,
  quota_exceeded: 429,
  url_unreachable: 422,
  url_forbidden: 403,
  duplicate_url: 409,
  content_blocked: 422,
  not_found: 404,
};

export class ApiError extends Error {
  code: string;
  next_action: string;
  status: number;
  extra: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    next_action: string,
    status?: number,
    extra?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.next_action = next_action;
    this.status = status ?? STATUS[code] ?? 400;
    this.extra = extra ?? {};
  }
}

export function errorBody(err: unknown) {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: {
        code: err.code,
        message: err.message,
        next_action: err.next_action,
        ...err.extra,
      },
    };
  }
  console.error(err);
  return {
    status: 500,
    body: {
      code: "invalid_input",
      message: "Server error",
      next_action: "Retry once. If it keeps failing, check the server log.",
    },
  };
}
