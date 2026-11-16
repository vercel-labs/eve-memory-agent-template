import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

import { script, snapshotOf } from "./support";

const USER_FACT = "E2E: prefers answers in bullet points";
const CHANNEL_FACT = "E2E: this channel writes in British English";

const recalled = (reply: string | null | undefined, slot: string) =>
  snapshotOf(reply).messages.filter((message) =>
    message.text.startsWith(`# Persistent memories for ${slot}`)
  );

const entryIndex = (text: string | undefined, fact: string): number =>
  Number(
    text
      ?.split("\n")
      .find((line) => line.endsWith(`: ${fact}`))
      ?.split(":")[0]
  );

export default defineEval({
  description:
    "Each memory slot saves through its own tool, is recalled into later sessions as untrusted user-role data, and forgets removed entries.",
  async test(t) {
    const saved = await t.send(
      script({
        toolCalls: [
          { input: { text: USER_FACT }, name: "user-preferences__save_memory" },
          {
            input: { text: CHANNEL_FACT },
            name: "channel-preferences__save_memory",
          },
          // Saving the same text again must not add a second entry.
          { input: { text: USER_FACT }, name: "user-preferences__save_memory" },
        ],
      })
    );
    saved.calledTool("user-preferences__save_memory", { count: 2 });
    saved.calledTool("channel-preferences__save_memory", { count: 1 });
    saved.noFailedCalls();

    const later = await t.send("What do you remember?");
    const userRecall = recalled(later.reply, "user-preferences");
    const channelRecall = recalled(later.reply, "channel-preferences");
    t.check(
      userRecall.map((message) => message.role),
      equals(["user"])
    ).label("user-memory-recalled-as-user-role");
    t.check(
      channelRecall.map((message) => message.role),
      equals(["user"])
    ).label("channel-memory-recalled-as-user-role");
    t.check(
      userRecall[0]?.text,
      satisfies(
        (text: string | undefined) =>
          text?.split(USER_FACT).length === 2 && !text.includes(CHANNEL_FACT),
        "user memory holds the user fact once and no channel fact"
      )
    );
    t.check(
      channelRecall[0]?.text,
      satisfies(
        (text: string | undefined) =>
          text?.split(CHANNEL_FACT).length === 2 && !text.includes(USER_FACT),
        "channel memory holds the channel fact once and no user fact"
      )
    );
    t.check(
      snapshotOf(later.reply).messages.filter(
        (message) => message.role === "system"
      ),
      satisfies(
        (system: { text: string }[]) =>
          system.every(
            ({ text }) =>
              !(text.includes(USER_FACT) || text.includes(CHANNEL_FACT))
          ),
        "recalled memory never enters the system prompt"
      )
    );

    const removed = await later.session.send(
      script({
        toolCalls: [
          {
            input: { index: entryIndex(userRecall[0]?.text, USER_FACT) },
            name: "user-preferences__remove_memory",
          },
          {
            input: {
              index: entryIndex(channelRecall[0]?.text, CHANNEL_FACT),
            },
            name: "channel-preferences__remove_memory",
          },
        ],
      })
    );
    removed.calledTool("user-preferences__remove_memory", { count: 1 });
    removed.calledTool("channel-preferences__remove_memory", { count: 1 });
    removed.noFailedCalls();

    const afterRemoval = await t.send("What do you remember now?");
    t.check(
      snapshotOf(afterRemoval.reply).messages,
      satisfies(
        (messages: { text: string }[]) =>
          messages.every(
            ({ text }) =>
              !(text.includes(USER_FACT) || text.includes(CHANNEL_FACT))
          ),
        "removed entries are not recalled in a new session"
      )
    );
    t.succeeded();
  },
});
