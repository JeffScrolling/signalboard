import { errorBody } from "./errors";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof SyntaxError) {
    return json(
      {
        code: "invalid_input",
        message: "Invalid JSON",
        next_action: "Send a JSON object with Content-Type application/json.",
      },
      400,
    );
  }
  const { status, body } = errorBody(err);
  return json(body, status);
}
