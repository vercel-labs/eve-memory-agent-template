import { describe, expect, it, vi } from "vitest";

import { requireEnv } from "./env";

describe("requireEnv", () => {
  it("returns the configured value without trimming it", () => {
    vi.stubEnv("EXAMPLE_SETTING", " slack/memory-agent ");
    expect(requireEnv("EXAMPLE_SETTING", "slack/your-agent")).toBe(
      " slack/memory-agent "
    );
  });

  it.each([undefined, ""])(
    "names the variable and an example when it is %j",
    (value) => {
      vi.stubEnv("EXAMPLE_SETTING", value);
      expect(() => requireEnv("EXAMPLE_SETTING", "slack/your-agent")).toThrow(
        "EXAMPLE_SETTING environment variable is not set. Set it to a value like 'slack/your-agent'."
      );
    }
  );
});
