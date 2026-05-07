const assert = require("node:assert/strict");
const {
  parseRequestOrSendError,
  sendValidatedJson
} = require("../../../backend/route-validation.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type ValidationIssue = {
  path: string;
};

type LocalizedErrorCall = [
  unknown,
  number,
  unknown,
  string,
  string,
  Record<string, unknown>,
  string,
  { validationErrors: ValidationIssue[] }
];

function createSchema<T>(validate: (input: unknown) => T | null) {
  return {
    safeParse(input: unknown) {
      const data = validate(input);
      if (data) {
        return {
          success: true,
          data
        };
      }

      return {
        success: false,
        error: {
          issues: [
            {
              code: "invalid_type",
              path: ["payload", "name"],
              message: "Expected a string name."
            }
          ]
        }
      };
    }
  };
}

function requireLocalizedErrorCall(call: LocalizedErrorCall | null): LocalizedErrorCall {
  if (!call) {
    throw new Error("Expected a localized validation error call.");
  }

  return call;
}

register("parseRequestOrSendError returns parsed request data for valid payloads", () => {
  let localizedErrorCalls = 0;
  const schema = createSchema((input) => {
    if (typeof input === "object" && input && (input as { name?: unknown }).name === "Alice") {
      return { name: "Alice" };
    }

    return null;
  });

  const parsed = parseRequestOrSendError({}, { name: "Alice" }, schema, () => {
    localizedErrorCalls += 1;
  });

  assert.deepEqual(parsed, { name: "Alice" });
  assert.equal(localizedErrorCalls, 0);
});

register("parseRequestOrSendError maps invalid request payloads to validation errors", () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;
  const schema = createSchema(() => null);

  const parsed = parseRequestOrSendError(
    {},
    { name: 17 },
    schema,
    (...args: LocalizedErrorCall) => {
      localizedErrorCall = args;
    }
  );

  const call = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(parsed, null);
  assert.equal(call[1], 400);
  assert.equal(call[6], "REQUEST_VALIDATION_FAILED");
  assert.deepEqual(
    call[7].validationErrors.map((entry) => entry.path),
    ["payload.name"]
  );
});

register("sendValidatedJson sends parsed response data and custom headers", () => {
  let sentStatusCode = 0;
  let sentPayload: Record<string, unknown> | null = null;
  let sentHeaders: Record<string, string> | null = null;
  let localizedErrorCalls = 0;
  const schema = createSchema((input) => {
    if (typeof input === "object" && input && (input as { name?: unknown }).name === "Alice") {
      return { name: "Alice", ok: true };
    }

    return null;
  });

  const sent = sendValidatedJson(
    {},
    201,
    { name: "Alice", ignored: true },
    schema,
    (
      _res: unknown,
      statusCode: number,
      payload: Record<string, unknown>,
      headers: Record<string, string>
    ) => {
      sentStatusCode = statusCode;
      sentPayload = payload;
      sentHeaders = headers;
    },
    () => {
      localizedErrorCalls += 1;
    },
    {
      "X-Test-Header": "route-validation"
    }
  );

  assert.equal(sent, true);
  assert.equal(localizedErrorCalls, 0);
  assert.equal(sentStatusCode, 201);
  assert.deepEqual(sentPayload, { name: "Alice", ok: true });
  assert.deepEqual(sentHeaders, { "X-Test-Header": "route-validation" });
});

register("sendValidatedJson maps invalid response payloads without sending JSON", () => {
  let sendJsonCalls = 0;
  let localizedErrorCall: LocalizedErrorCall | null = null;
  const schema = createSchema(() => null);

  const sent = sendValidatedJson(
    {},
    200,
    { name: 17 },
    schema,
    () => {
      sendJsonCalls += 1;
    },
    (...args: LocalizedErrorCall) => {
      localizedErrorCall = args;
    }
  );

  const call = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(sent, false);
  assert.equal(sendJsonCalls, 0);
  assert.equal(call[1], 500);
  assert.equal(call[6], "RESPONSE_VALIDATION_FAILED");
  assert.deepEqual(
    call[7].validationErrors.map((entry) => entry.path),
    ["payload.name"]
  );
});
