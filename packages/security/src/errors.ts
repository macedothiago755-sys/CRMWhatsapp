/**
 * Standardized error codes — see docs/security/security-architecture.md §10.
 * Never leak stack traces to clients; map internal errors to one of these.
 */
export const ERROR_CODES = [
  "CUSTOMER_NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  "STOCK_UNAVAILABLE",
  "VTEX_UNAVAILABLE",
  "AI_UNAVAILABLE",
  "WHATSAPP_UNAVAILABLE",
  "INVALID_CONSENT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class PolarError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PolarError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON(): { code: ErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  CUSTOMER_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  STOCK_UNAVAILABLE: 409,
  VTEX_UNAVAILABLE: 503,
  AI_UNAVAILABLE: 503,
  WHATSAPP_UNAVAILABLE: 503,
  INVALID_CONSENT: 403,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
};

export function polarError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): PolarError {
  return new PolarError(code, message, STATUS_BY_CODE[code], details);
}
