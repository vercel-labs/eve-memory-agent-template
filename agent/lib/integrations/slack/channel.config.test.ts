import type { SlackChannelConfig } from "eve/channels/slack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inboundContext, slackMessage } from "../../testing/slack";
import { ignoreMessageEdit, resolveSlackChannelConfig } from "./channel";

const configured = resolveSlackChannelConfig;
const deliverEdit: NonNullable<SlackChannelConfig["onMessageEdited"]> = () =>
  null;

describe("resolveSlackChannelConfig", () => {
  beforeEach(() => {
    vi.stubEnv("SLACK_CONNECTOR", "slack/memory-agent");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("reads credentials from the configured Vercel Connect connector", () => {
    expect(configured().credentials).toMatchObject({
      vercelConnect: { connector: "slack/memory-agent" },
    });
  });

  it("answers mentions and DMs, ignores other messages, and drops edits", () => {
    const config = configured();
    expect(config.onAppMention).toBeTypeOf("function");
    expect(config.onDirectMessage).toBeTypeOf("function");
    expect(config.onMessage).toBeUndefined();
    expect(config.onMessageEdited).toBe(ignoreMessageEdit);
  });

  it("loads thread history since the agent's last reply by default", () => {
    expect(configured().threadContext).toStrictEqual({
      since: "last-agent-reply",
    });
    expect(
      configured({ threadContext: { since: "thread-root" } }).threadContext
    ).toStrictEqual({ since: "thread-root" });
  });

  it("leaves eve's own sender lookups off, so profiles are fetched once and emails never requested", () => {
    expect(configured().messageContext).toBeUndefined();
  });

  it("lets a caller deliver edits with its own handler", () => {
    expect(configured({ onMessageEdited: deliverEdit }).onMessageEdited).toBe(
      deliverEdit
    );
  });

  it("passes other native settings through unchanged", () => {
    expect(configured({ route: "/custom/slack" }).route).toBe("/custom/slack");
  });

  it.each(["onAppMention", "onDirectMessage"] as const)(
    "starts a turn from %s with the sender's Slack principal and identity context",
    async (hook) => {
      const result = await configured()[hook]?.(
        inboundContext(),
        slackMessage({ text: "remember that I prefer short answers" })
      );
      expect(result?.auth).toMatchObject({
        authenticator: "slack-webhook",
        principalId: "slack:T123:U123",
        principalType: "user",
      });
      expect(result?.context).toHaveLength(1);
      expect(result?.context?.[0]).toContain(
        "Slack identities for message 100.2:"
      );
      expect(result?.context?.[0]).toContain("Sender: <@U123>");
    }
  );

  it.each(["onAppMention", "onDirectMessage"] as const)(
    "drops bot messages in %s without looking up profiles",
    async (hook) => {
      const ctx = inboundContext();
      const result = await configured()[hook]?.(
        ctx,
        slackMessage({
          author: {
            fullName: undefined,
            isBot: true,
            isMe: false,
            userId: "U999",
            userName: undefined,
          },
        })
      );
      expect(result).toBeNull();
      expect(ctx.slack.request).not.toHaveBeenCalled();
    }
  );
});
