import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { api, clearAccessToken, getAccessToken, jsonInit, setAccessToken, setSessionExpiredHandler, ApiError } from "../lib/api";

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({
      code: "UNAUTHORIZED",
      message: "Akses tidak sah",
      details: {},
    }),
    {
      status: 401,
      headers: { "content-type": "application/json" },
    },
  );
}

describe("api client", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "";
    clearAccessToken();
    setSessionExpiredHandler(null);
  });

  afterEach(() => {
    clearAccessToken();
    setSessionExpiredHandler(null);
    globalThis.fetch = originalFetch;

    if (originalApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    }
  });

  it("uses credentials include and bearer token from memory", async () => {
    setAccessToken("access-123");

    const fetchMock = mock.fn(async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(input), "http://localhost:3001/api/v1/me");
      assert.equal(init?.credentials, "include");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer access-123");
      return Response.json({ ok: true });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await api<{ ok: boolean }>("/me");

    assert.deepEqual(result, { ok: true });
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("refreshes once after 401 and retries with the new token", async () => {
    setAccessToken("expired-token");
    let requestCount = 0;

    const fetchMock = mock.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requestCount += 1;
      const url = String(input);

      if (url === "http://localhost:3001/api/v1/auth/refresh") {
        assert.equal(init?.method, "POST");
        assert.equal(init?.credentials, "include");
        return Response.json({
          accessToken: "fresh-token",
          user: {
            id: "user-1",
            name: "Budi",
            email: "budi@example.com",
            role: "Owner",
            permissions: ["user.manage"],
            emailVerifiedAt: null,
          },
          tenant: {
            id: "tenant-1",
            name: "Toko Budi",
            slug: "toko-budi",
            subscriptionStatus: "TRIAL",
            trialEndDate: "2026-12-01T00:00:00.000Z",
          },
        });
      }

      if (requestCount === 1) {
        return unauthorizedResponse();
      }

      assert.equal(url, "http://localhost:3001/api/v1/me");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fresh-token");
      return Response.json({ ok: true });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await api<{ ok: boolean }>("/me");

    assert.deepEqual(result, { ok: true });
    assert.equal(fetchMock.mock.calls.length, 3);
  });

  it("clears the in-memory session when refresh retry fails", async () => {
    setAccessToken("expired-token");
    let sessionExpiredCalls = 0;

    setSessionExpiredHandler(() => {
      sessionExpiredCalls += 1;
    });

    const fetchMock = mock.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url === "http://localhost:3001/api/v1/auth/refresh") {
        return unauthorizedResponse();
      }

      assert.equal(url, "http://localhost:3001/api/v1/me");
      return unauthorizedResponse();
    });

    globalThis.fetch = fetchMock as typeof fetch;

    await assert.rejects(api("/me"), (error) => error instanceof ApiError && error.status === 401);

    assert.equal(fetchMock.mock.calls.length, 2);
    assert.equal(getAccessToken(), null);
    assert.equal(sessionExpiredCalls, 1);
  });

  it("does not refresh public auth endpoints on 401", async () => {
    setAccessToken("expired-token");
    let sessionExpiredCalls = 0;

    setSessionExpiredHandler(() => {
      sessionExpiredCalls += 1;
    });

    const fetchMock = mock.fn(async (input: string | URL | Request) => {
      assert.equal(String(input), "http://localhost:3001/api/v1/auth/login");
      return unauthorizedResponse();
    });

    globalThis.fetch = fetchMock as typeof fetch;

    await assert.rejects(api("/auth/login", { method: "POST" }), (error) => error instanceof ApiError && error.status === 401);

    assert.equal(fetchMock.mock.calls.length, 1);
    assert.equal(sessionExpiredCalls, 0);
  });

  it("jsonInit serializes objects once", () => {
    const init = jsonInit({ openingCash: 0 });
    assert.equal(init.body, '{"openingCash":0}');
    assert.equal(new Headers(init.headers).get("content-type"), "application/json");
  });

  it("treats empty 200 body as null", async () => {
    const fetchMock = mock.fn(async () => new Response("", { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await api<{ id: string } | null>("/cashier-sessions/current");

    assert.equal(result, null);
    assert.equal(fetchMock.mock.calls.length, 1);
  });
});
