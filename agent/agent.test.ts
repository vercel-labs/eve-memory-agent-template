import type { GatewayModelId } from "ai";
import { describe, expect, expectTypeOf, it } from "vitest";

import agent from "./agent";
import { exceedsSessionInputBudget } from "./lib/limits";

// GatewayModelId ends in `string & {}`; this keeps only the IDs the catalog names.
type CatalogModelId<T = GatewayModelId> = T extends string
  ? string extends T
    ? never
    : T
  : never;

describe("agent definition", () => {
  it("runs on Claude Fable 5.2 through AI Gateway", () => {
    expect(agent.model).toBe("anthropic/claude-fable-5.2");
  });

  it("uses a model ID the installed AI Gateway catalog lists", () => {
    expectTypeOf<"anthropic/claude-fable-5.2">().toExtend<CatalogModelId>();
    // Guards the helper type: an unlisted ID must not pass the check above.
    expectTypeOf<"anthropic/not-a-model">().not.toExtend<CatalogModelId>();
  });

  it("pauses sessions with the shared input budget", () => {
    expect(agent.limits?.sessionUsage).toBe(exceedsSessionInputBudget);
  });
});
