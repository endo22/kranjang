export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "STOCK_INSUFFICIENT",
  "SUBSCRIPTION_INACTIVE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiErrorBody = {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
};
