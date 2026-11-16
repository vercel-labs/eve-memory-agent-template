import type { AgentLimitsDefinition, TokenUsage } from "eve";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  exceedsSessionInputBudget,
  SESSION_INPUT_TOKEN_BUDGET,
} from "./limits";

const usage = (overrides: Partial<TokenUsage> = {}): TokenUsage => ({
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  ...overrides,
});

describe("exceedsSessionInputBudget", () => {
  it.each([
    [0, false],
    [SESSION_INPUT_TOKEN_BUDGET - 1, false],
    [SESSION_INPUT_TOKEN_BUDGET, true],
    [SESSION_INPUT_TOKEN_BUDGET + 1, true],
  ])(
    "with %i input tokens in the window, pausing is %s",
    (inputTokens, paused) => {
      expect(
        exceedsSessionInputBudget({
          total: usage({ inputTokens }),
          window: usage({ inputTokens }),
        })
      ).toBe(paused);
    }
  );

  it("counts history replayed from the prompt cache, as the previous input limit did", () => {
    // eve reports cache reads inside inputTokens; its own default subtracts them.
    const window = usage({
      cacheReadTokens: SESSION_INPUT_TOKEN_BUDGET - 10,
      inputTokens: SESSION_INPUT_TOKEN_BUDGET,
    });
    expect(exceedsSessionInputBudget({ total: window, window })).toBe(true);
  });

  it("measures the window since the last approval, not the session total", () => {
    expect(
      exceedsSessionInputBudget({
        total: usage({ inputTokens: SESSION_INPUT_TOKEN_BUDGET * 3 }),
        window: usage({ inputTokens: 1 }),
      })
    ).toBe(false);
  });

  it("ignores output tokens and cost", () => {
    expect(
      exceedsSessionInputBudget({
        total: usage(),
        window: usage({
          costUsd: 1000,
          outputTokens: SESSION_INPUT_TOKEN_BUDGET * 10,
        }),
      })
    ).toBe(false);
  });

  it("fits eve's session usage limit", () => {
    expectTypeOf(exceedsSessionInputBudget).toExtend<
      Exclude<AgentLimitsDefinition["sessionUsage"], false | undefined>
    >();
  });
});
