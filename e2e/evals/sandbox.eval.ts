import { defineEval } from "eve/evals";
import { equals, includes } from "eve/evals/expect";

import { script, snapshotOf } from "./support";

export default defineEval({
  description:
    "Local sessions run bash and read_file in the just-bash sandbox, where a file written by one call is readable by the next.",
  async test(t) {
    const turn = await t.send(
      script(
        {
          toolCalls: [
            {
              input: {
                command:
                  "printf 'reference text\\n' > note.txt && cat note.txt",
              },
              name: "bash",
            },
          ],
        },
        { toolCalls: [{ input: { filePath: "note.txt" }, name: "read_file" }] }
      )
    );
    turn.toolOrder(["bash", "read_file"]);
    turn.noFailedCalls();
    const { toolResults } = snapshotOf(turn.reply);
    t.check(
      toolResults.map(({ isError, name }) => ({ isError, name })),
      equals([
        { isError: false, name: "bash" },
        { isError: false, name: "read_file" },
      ])
    ).label("sandbox-calls-completed");
    t.check(JSON.stringify(toolResults[0]?.output), includes("reference text"));
    t.check(
      JSON.stringify(toolResults[1]?.output),
      includes("1: reference text")
    );
    t.succeeded();
  },
});
