import { connectSlackCredentials } from "@vercel/connect/eve";
import { defaultSlackAuth, slackChannel } from "eve/channels/slack";

import { requireEnv } from "../lib/utils/env";

const THREAD_GUIDANCE =
  "You are part of this Slack thread, so you see replies people send each other. This " +
  "reply doesn't mention you. Answer only if it's meant for you; otherwise call `no_reply`.";

/**
 * Connects the agent to Slack through the configured Vercel Connect connector.
 *
 * @remarks
 * Only human senders start turns, each with their own workspace-scoped identity from
 * `defaultSlackAuth`, which the memory scopes read. Mentions and DMs always reach the agent.
 * Replies and edits in a thread that already has a session arrive deferred with guidance, so
 * the agent can stay silent with `no_reply`. `messageContext.users` adds each sender's Slack
 * display and real name to the model's `<sender>` block, but never their email. Names are
 * context only and never decide identity or memory scope.
 */
export default slackChannel({
  credentials: connectSlackCredentials(
    requireEnv("SLACK_CONNECTOR", "slack/your-agent")
  ),
  messageContext: { users: true },
  async onMessage(ctx, message) {
    if (message.author?.isBot !== false) {
      return null;
    }
    const auth = defaultSlackAuth(message, ctx);
    if (!auth) {
      return null;
    }
    const isDirectMessage = message.raw.channel_type === "im";
    if (ctx.isBotMentioned() || isDirectMessage) {
      return { auth };
    }
    // An edit only reaches a thread that has a session, including an edit to its first message.
    if (
      ctx.edit ||
      (message.threadTs !== message.ts && (await ctx.isSubscribed()))
    ) {
      return { auth, guidance: THREAD_GUIDANCE, status: "deferred" };
    }
    return null;
  },
  threadContext: { since: "last-agent-reply" },
});
