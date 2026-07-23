export type ApiErrorBody = {
  type: string;
  msg?: string;
  hint?: string;
};

export class ApiError extends Error {
  readonly type: string;
  readonly hint?: string;
  readonly status: number;

  constructor(
    type: string,
    msg?: string,
    options: { hint?: string; status?: number } = {},
  ) {
    super(msg ?? type);
    this.name = "ApiError";
    this.type = type;
    this.hint = options.hint;
    this.status = options.status ?? 400;
  }

  toBody(): ApiErrorBody {
    return {
      type: this.type,
      ...(this.message ? { msg: this.message } : {}),
      ...(this.hint ? { hint: this.hint } : {}),
    };
  }
}

export function apiErrorResponse(error: ApiError): Response {
  return Response.json(error.toBody(), { status: error.status });
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    typeof (value as ApiErrorBody).type === "string"
  );
}
