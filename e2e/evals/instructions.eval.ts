import { defineEval } from "eve/evals";
import { equals, includes, satisfies } from "eve/evals/expect";

import { readRepositoryFile } from "../agent/lib/repository";
import { script, snapshotOf } from "./support";

const TIME_REFERENCE =
  /^Current date and time: (?<startedAt>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \(UTC\)\.$/u;

const timeReferences = (reply: string | null | undefined): string[] =>
  snapshotOf(reply)
    .messages.filter((message) => message.role === "user")
    .flatMap((message) => {
      const startedAt = TIME_REFERENCE.exec(message.text)?.groups?.startedAt;
      return startedAt ? [startedAt] : [];
    });

export default defineEval({
  description:
    "The model reads the template's system instructions, and one UTC time reference per turn as a user message.",
  async test(t) {
    const first = await t.send(
      script({
        toolCalls: [{ input: { command: "echo one" }, name: "bash" }],
      })
    );
    const system = snapshotOf(first.reply).messages.filter(
      (message) => message.role === "system"
    );
    t.check(system.length, equals(1)).label("one-system-message");
    t.check(
      system[0]?.text,
      includes(readRepositoryFile("agent/instructions.md").trim())
    ).label("system-instructions");
    t.check(
      system[0]?.text,
      satisfies(
        (text: string | undefined) => !text?.includes("Current date and time"),
        "the time reference stays out of the system prompt"
      )
    );

    // The first turn made two model calls, around the bash call.
    const firstTurn = timeReferences(first.reply);
    t.check(firstTurn.length, equals(1)).label("one-reference-per-turn");

    const second = await first.session.send("What time is it?");
    const bothTurns = timeReferences(second.reply);
    t.check(bothTurns.length, equals(2)).label("new-reference-next-turn");
    t.check(bothTurns[0], equals(firstTurn[0])).label("earlier-reference-kept");
    t.check(
      bothTurns,
      satisfies(
        ([earlier, later]: string[]) =>
          earlier !== undefined && later !== undefined && earlier < later,
        "the second turn's reference is later than the first"
      )
    );
    t.succeeded();
  },
});
