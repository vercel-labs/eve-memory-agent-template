import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

import channelPreferences from "../../agent/memory/channel-preferences";
import userPreferences from "../../agent/memory/user-preferences";
import { script, snapshotOf } from "./support";

const AVAILABLE_TOOLS = [
  "bash",
  "channel-preferences__remove_memory",
  "channel-preferences__save_memory",
  "read_file",
  "user-preferences__remove_memory",
  "user-preferences__save_memory",
];

// eve offers web_search only to models with provider search, which the scripted
// model lacks, so this check can't tell whether its override exists. The unit
// test in agent/tools/tools.test.ts covers that file.
const DISABLED_TOOLS = [
  "agent",
  "edit_file",
  "web_fetch",
  "web_search",
  "write_file",
];

export default defineEval({
  description:
    "The model is offered only the sandbox reader tools and each memory slot's tools, and can't call a disabled built-in.",
  async test(t) {
    const offered = await t.send("Which tools do you have?");
    const { tools } = snapshotOf(offered.reply);
    t.check(
      tools.map((tool) => tool.name).toSorted(),
      equals(AVAILABLE_TOOLS)
    ).label("tool-names");

    const slotDescriptions = {
      "channel-preferences": channelPreferences.description,
      "user-preferences": userPreferences.description,
    };
    for (const [slot, description] of Object.entries(slotDescriptions)) {
      const slotTools = tools.filter((tool) =>
        tool.name.startsWith(`${slot}__`)
      );
      t.check(
        slotTools,
        satisfies(
          (found: typeof slotTools) =>
            found.length === 2 &&
            Boolean(description) &&
            found.every((tool) =>
              tool.description?.startsWith(`${description}`)
            ),
          `${slot} tools start with the slot description`
        )
      );
    }

    const attempted = await t.send(
      script({
        toolCalls: DISABLED_TOOLS.map((name) => ({ input: {}, name })),
      })
    );
    const { toolResults } = snapshotOf(attempted.reply);
    t.check(
      toolResults.map(({ isError, name }) => ({ isError, name })),
      equals(DISABLED_TOOLS.map((name) => ({ isError: true, name })))
    ).label("disabled-tools-rejected");
    t.check(
      toolResults,
      satisfies(
        (results: typeof toolResults) =>
          results.every((result) =>
            String(result.output).includes("unavailable tool")
          ),
        "each disabled tool is reported as unavailable"
      )
    );
  },
});
