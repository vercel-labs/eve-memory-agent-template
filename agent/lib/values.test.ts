import { describe, expect, expectTypeOf, it } from "vitest";

import { isString } from "./values";

describe("isString", () => {
  it.each(["", "C123"])("accepts the string %j", (value) => {
    expect(isString(value)).toBe(true);
  });

  it.each([undefined, null, 0, ["C123"], { channel: "C123" }])(
    "rejects %j",
    (value) => {
      expect(isString(value)).toBe(false);
    }
  );

  it("narrows unknown values to string", () => {
    expectTypeOf(isString).parameter(0).toBeUnknown();
    expectTypeOf(isString).guards.toBeString();
  });
});
