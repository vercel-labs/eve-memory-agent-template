import { defineAgent } from "eve";

import { exceedsSessionInputBudget } from "./lib/limits";

export default defineAgent({
  limits: {
    sessionUsage: exceedsSessionInputBudget,
  },
  model: "anthropic/claude-fable-5.2",
});
