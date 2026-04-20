import { z } from "zod";

import { registerFrontendObservabilityReporter } from "@frontend-core/observability.mts";
import { requestJson } from "@frontend-core/api/http.mts";

import { afterEach, describe, expect, it, vi } from "vitest";

const okResponseSchema = z.object({
  ok: z.literal(true)
});

describe("frontend API observability boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    registerFrontendObservabilityReporter(null);
  });

  it("captures network failures as unexpected frontend errors", async () => {
    const reporter = vi.fn();
    registerFrontendObservabilityReporter(reporter);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(
      requestJson({
        path: "/api/profile",
        responseSchema: okResponseSchema,
        responseSchemaName: "OkResponse",
        errorMessage: "Profile unavailable."
      })
    ).rejects.toMatchObject({
      category: "network",
      kind: "network",
      path: "/api/profile"
    });

    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "network",
        kind: "network",
        path: "/api/profile"
      }),
      expect.objectContaining({
        category: "network",
        kind: "network",
        path: "/api/profile"
      })
    );
  });

  it("captures HTTP 5xx responses with the request id header", async () => {
    const reporter = vi.fn();
    registerFrontendObservabilityReporter(reporter);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Server exploded.", code: "SERVER_FAILURE" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": "req-500"
          }
        })
      )
    );

    await expect(
      requestJson({
        path: "/api/profile",
        responseSchema: okResponseSchema,
        responseSchemaName: "OkResponse",
        errorMessage: "Profile unavailable."
      })
    ).rejects.toMatchObject({
      category: "unexpected_5xx",
      kind: "http",
      statusCode: 500,
      requestId: "req-500",
      code: "SERVER_FAILURE"
    });

    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "unexpected_5xx",
        requestId: "req-500",
        statusCode: 500
      }),
      expect.objectContaining({
        category: "unexpected_5xx",
        kind: "http",
        requestId: "req-500",
        statusCode: 500,
        code: "SERVER_FAILURE"
      })
    );
  });

  it("captures invalid successful payloads as response validation failures", async () => {
    const reporter = vi.fn();
    registerFrontendObservabilityReporter(reporter);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": "req-schema"
          }
        })
      )
    );

    await expect(
      requestJson({
        path: "/api/profile",
        responseSchema: okResponseSchema,
        responseSchemaName: "OkResponse",
        errorMessage: "Profile unavailable.",
        fallbackMessage: "Profile payload invalid."
      })
    ).rejects.toMatchObject({
      category: "validation",
      kind: "response_validation",
      requestId: "req-schema",
      statusCode: 200
    });

    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "validation",
        requestId: "req-schema"
      }),
      expect.objectContaining({
        category: "validation",
        kind: "response_validation",
        schemaName: "OkResponse",
        requestId: "req-schema"
      })
    );
  });

  it("does not capture expected HTTP 401 responses", async () => {
    const reporter = vi.fn();
    registerFrontendObservabilityReporter(reporter);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Sign in to continue.", code: "AUTH_REQUIRED" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": "req-auth"
          }
        })
      )
    );

    await expect(
      requestJson({
        path: "/api/auth/session",
        responseSchema: okResponseSchema,
        responseSchemaName: "OkResponse",
        errorMessage: "Unable to load session."
      })
    ).rejects.toMatchObject({
      category: "auth",
      kind: "http",
      statusCode: 401,
      requestId: "req-auth",
      code: "AUTH_REQUIRED"
    });

    expect(reporter).not.toHaveBeenCalled();
  });

  it("wraps request schema mismatches as controlled validation errors", async () => {
    const reporter = vi.fn();
    registerFrontendObservabilityReporter(reporter);

    const requestSchema = z.object({
      count: z.number().int()
    });

    await expect(
      requestJson<unknown, z.infer<typeof okResponseSchema>>({
        path: "/api/action",
        method: "POST",
        body: {
          count: "bad"
        },
        requestSchema,
        requestSchemaName: "CountRequest",
        responseSchema: okResponseSchema,
        responseSchemaName: "OkResponse",
        errorMessage: "Request failed."
      })
    ).rejects.toMatchObject({
      category: "validation",
      kind: "request_validation",
      path: "/api/action"
    });

    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "validation",
        kind: "request_validation"
      }),
      expect.objectContaining({
        category: "validation",
        kind: "request_validation",
        schemaName: "CountRequest"
      })
    );
  });
});
