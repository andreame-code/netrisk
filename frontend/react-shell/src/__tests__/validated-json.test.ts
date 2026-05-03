import { readValidatedJson } from "@frontend-core/validated-json.mts";

import { describe, expect, it } from "vitest";

type TestPayload = {
  ok: boolean;
};

const validSchema = {
  safeParse(input: unknown) {
    if (input && typeof input === "object" && "ok" in input) {
      return { success: true as const, data: input as TestPayload };
    }

    return { success: false as const, error: new Error("Invalid payload.") };
  }
};

describe("validated json boundary", () => {
  it("returns parsed data when the response matches the schema", async () => {
    await expect(
      readValidatedJson(
        new Response(JSON.stringify({ ok: true })),
        validSchema,
        "Fallback message",
        "TestPayload"
      )
    ).resolves.toEqual({ ok: true });
  });

  it("wraps malformed json and schema failures with the fallback message", async () => {
    await expect(
      readValidatedJson(new Response("{"), validSchema, "Response unavailable", "TestPayload")
    ).rejects.toThrow("Response unavailable");

    await expect(
      readValidatedJson(
        new Response(JSON.stringify({ ok: true })),
        {
          safeParse() {
            return { success: false as const, error: new Error("Invalid payload.") };
          }
        },
        "Response invalid",
        "TestPayload"
      )
    ).rejects.toThrow("Response invalid");
  });
});
