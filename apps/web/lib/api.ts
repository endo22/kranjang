import type { ApiErrorBody } from "@kranjang/shared";

const DEFAULT_API_URL = "http://localhost:3001/api/v1";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  emailVerifiedAt: string | null;
};

export type AuthTenant = {
  id: string;
  name: string;
  slug: string;
  subscriptionStatus: string;
  trialEndDate: string;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
  tenant: AuthTenant;
};

export type MeProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
};

export type RolePermission = {
  code: string;
  module: string;
  description: string;
};

export type RoleRecord = {
  id: string;
  name: string;
  permissions: RolePermission[];
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: {
    id: string;
    name: string;
  };
  createdAt: string;
};

export type SettingsRecord = {
  name: string;
  phone: string | null;
  timezone: string;
  allowNegativeStock: boolean;
  taxPercent: string;
  taxInclusive: boolean;
  receiptFooter: string | null;
  trialEndDate: string;
  subscriptionStatus: string;
};

type ApiOptions = {
  retryOnUnauthorized?: boolean;
  includeAuthorization?: boolean;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

let accessToken: string | null = null;

function getApiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();
  return value && value.length > 0 ? value.replace(/\/+$/, "") : DEFAULT_API_URL;
}

function toUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function parseJsonBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return (await response.json()) as unknown;
}

async function createApiError(response: Response) {
  const body = (await parseJsonBody(response)) as Partial<ApiErrorBody> | null;
  return new ApiError(response.status, {
    code: typeof body?.code === "string" ? body.code : "INTERNAL_ERROR",
    message: typeof body?.message === "string" ? body.message : "Terjadi kesalahan. Silakan coba lagi.",
    details: body?.details && typeof body.details === "object" ? body.details : {},
  });
}

async function parseResponse<T>(response: Response) {
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function refreshSession() {
  return api<AuthSession>(
    "/auth/refresh",
    {
      method: "POST",
    },
    {
      retryOnUnauthorized: false,
      includeAuthorization: false,
    },
  );
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

export function getAccessToken() {
  return accessToken;
}

export function jsonInit(body: unknown): Pick<RequestInit, "body" | "headers"> {
  return {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  };
}

export async function api<T>(path: string, init: RequestInit = {}, options: ApiOptions = {}) {
  const { retryOnUnauthorized = true, includeAuthorization = true } = options;
  const headers = new Headers(init.headers);

  if (accessToken && includeAuthorization) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(toUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retryOnUnauthorized && path !== "/auth/refresh") {
    const session = await refreshSession();
    setAccessToken(session.accessToken);

    return api<T>(path, init, {
      retryOnUnauthorized: false,
      includeAuthorization,
    });
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  return parseResponse<T>(response);
}
