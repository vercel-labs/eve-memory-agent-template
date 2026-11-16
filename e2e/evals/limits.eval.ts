import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { openInteractions } from "eve/events";

import { SESSION_INPUT_TOKEN_BUDGET } from "../../agent/lib/limits";
import { script } from "./support";

export default defineEval({
  description:
    "A session pauses on a budget prompt once it has sent its input-token budget, and approving it opens a new window.",
  async test(t) {
    const under = await t.send(
      script({
        text: "under budget",
        usage: { inputTokens: SESSION_INPUT_TOKEN_BUDGET - 1 },
      })
    );
    t.check(under.status, equals("completed")).label("under-budget-completes");

    // One more token brings the window to exactly the budget.
    const reached = await under.session.send(
      script({ text: "budget reached", usage: { inputTokens: 1 } })
    );
    t.check(reached.reply, equals("budget reached")).label(
      "crossing-call-finishes"
    );

    const paused = await reached.session.send("Are you still there?");
    t.check(paused.status, equals("awaiting-input")).label(
      "pauses-before-next-model-call"
    );
    // CUSTOMIZATION.md tells people to choose Approve, so the labels are checked too.
    t.check(
      openInteractions(paused.view).map(({ request }) => ({
        kind: request.kind,
        options: request.options?.map((option) => option.label),
      })),
      equals([{ kind: "budget", options: ["Approve", "Stop"] }])
    ).label("budget-prompt");

    const resumed = await paused.session.respondAll("approve");
    t.check(resumed.status, equals("completed")).label(
      "approval-resumes-the-turn"
    );

    const next = await resumed.session.send(script({ text: "new window" }));
    t.check(next.reply, equals("new window")).label(
      "new-window-after-approval"
    );
  },
});
