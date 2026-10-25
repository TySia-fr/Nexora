/**
 * Errors the customer is allowed to see. Anything else is logged on the server
 * and surfaced as a generic message, so database errors and stack traces never
 * reach the browser.
 */
export type AppErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "OUT_OF_STOCK"
  | "UNAVAILABLE"
  | "CART_EMPTY"
  | "CART_CHANGED"
  | "COUPON_REJECTED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "PAYMENTS_DISABLED"
  | "RATE_LIMITED"
  | "CONFLICT";

const STATUS: Record<AppErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION: 400,
  OUT_OF_STOCK: 409,
  UNAVAILABLE: 409,
  CART_EMPTY: 400,
  CART_CHANGED: 409,
  COUPON_REJECTED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_TRANSITION: 409,
  PAYMENTS_DISABLED: 503,
  RATE_LIMITED: 429,
  CONFLICT: 409,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

export const GENERIC_ERROR = "Something went wrong on our side. Please try again.";

/** Result shape returned by server actions to client components. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; code: AppErrorCode | "INTERNAL"; message: string; fieldErrors?: Record<string, string> };

export function toActionError(e: unknown): Extract<ActionResult, { ok: false }> {
  if (isAppError(e)) {
    const fieldErrors = e.details?.fieldErrors as Record<string, string> | undefined;
    return { ok: false, code: e.code, message: e.message, ...(fieldErrors ? { fieldErrors } : {}) };
  }
  console.error("[nexora] unexpected error", e);
  return { ok: false, code: "INTERNAL", message: GENERIC_ERROR };
}
