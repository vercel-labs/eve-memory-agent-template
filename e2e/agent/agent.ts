import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

import agent from "../../agent/agent";
import { respond } from "./lib/scripted-model";

/**
 * Test double of the template's agent: its files and limits, with a scripted model in place of the AI Gateway model.
 *
 * @remarks Settings are read from the real definition, so the tests follow changes to it. Pass any setting added to agent/agent.ts through here too.
 */
export default defineAgent({
  limits: agent.limits,
  model: mockModel({ modelId: "scripted", respond }),
});
