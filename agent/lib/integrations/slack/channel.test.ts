import type { connectSlackCredentials } from "@vercel/connect/eve";
import type { SlackChannelConfig } from "eve/channels/slack";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { inboundContext, slackMessage } from "../../testing/slack";
import {
  createSlackChannel,
  handleExplicitInvocation,
  ignoreMessageEdit,
  selectInboundHandlers,
  withIdentityContext,
} from "./channel";
import type { CreateSlackChannelConfig } from "./channel";
import type { createSlackIdentityResolver } from "./identity";

type Resolver = ReturnType<typeof createSlackIdentityResolver>;
type Handler = NonNullable<SlackChannelConfig["onMessage"]>;

const customMention: Handler = () => null;
const customDirectMessage: Handler = () => null;
const customMessage: Handler = () => null;
const humanAuthor = {
  fullName: undefined,
  isBot: false,
  isMe: false,
  userId: "U123",
  userName: undefined,
};

const resolverReturning = (names: Record<string, string>) =>
  vi.fn<Resolver>(() =>
    Promise.resolve(
      new Map(
        Object.entries(names).map(([userId, displayName]) => [
          userId,
          {
            displayName,
            profileImage: null,
            realName: null,
            userId,
            username: null,
          },
        ])
      )
    )
  );

describe("handleExplicitInvocation", () => {
  it("starts a turn with eve's Slack principal for a human author", async () => {
    const result = await handleExplicitInvocation(
      inboundContext(),
      slackMessage({ text: "hello" })
    );
    expect(result?.auth).toMatchObject({
      authenticator: "slack-webhook",
      issuer: "slack:T123",
      principalId: "slack:T123:U123",
      principalType: "user",
    });
    expect(result?.auth?.attributes.channel_id).toBe("C123");
  });

  it("returns an empty history, so eve keeps earlier thread replies as a transcript", async () => {
    // eve replays thread replies as conversation turns only when a hook returns no history.
    const result = await handleExplicitInvocation(
      inboundContext(),
      slackMessage({ text: "hello" })
    );
    expect(result?.history).toStrictEqual([]);
  });

  it.each([
    ["bots", { isBot: true }],
    ["the agent itself", { isMe: true }],
  ])("drops messages from %s", async (_name, author) => {
    const result = await handleExplicitInvocation(
      inboundContext(),
      slackMessage({ author: { ...humanAuthor, ...author } })
    );
    expect(result).toBeNull();
  });

  it.each([{}, { user: "" }, { user: "U123" }])(
    "drops messages without a verified author instead of sharing a principal (%o)",
    async (raw) => {
      const result = await handleExplicitInvocation(
        inboundContext(),
        slackMessage({ author: undefined, raw })
      );
      expect(result).toBeNull();
    }
  );
});

describe("selectInboundHandlers", () => {
  it("defaults mentions and DMs to explicit invocation without onMessage", () => {
    expect(selectInboundHandlers({})).toStrictEqual({
      onAppMention: handleExplicitInvocation,
      onDirectMessage: handleExplicitInvocation,
      onMessage: undefined,
    });
  });

  it("lets a caller's onMessage receive mentions and DMs", () => {
    expect(selectInboundHandlers({ onMessage: customMessage })).toStrictEqual({
      onAppMention: undefined,
      onDirectMessage: undefined,
      onMessage: customMessage,
    });
  });

  it("keeps explicitly supplied mention and DM handlers", () => {
    const handlers = {
      onAppMention: customMention,
      onDirectMessage: customDirectMessage,
      onMessage: customMessage,
    };
    expect(selectInboundHandlers(handlers)).toStrictEqual(handlers);
  });
});

describe("withIdentityContext", () => {
  it("returns undefined when no handler is supplied", () => {
    expect(
      withIdentityContext(undefined, resolverReturning({}))
    ).toBeUndefined();
  });

  it("skips profile lookups when the handler drops the message", async () => {
    const resolve = resolverReturning({ U123: "Sarah" });
    const handler = withIdentityContext(() => null, resolve);
    const result = await handler?.(inboundContext(), slackMessage());
    expect(result).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("appends the identity block after existing context", async () => {
    const resolve = resolverReturning({ U123: "Sarah" });
    const handler = withIdentityContext(
      () => ({ auth: null, context: ["existing"] }),
      resolve
    );
    const result = await handler?.(inboundContext(), slackMessage());
    expect(result?.context).toHaveLength(2);
    expect(result?.context?.[0]).toBe("existing");
    expect(result?.context?.[1]).toContain('Sender: "Sarah" (<@U123>)');
  });

  it("leaves the result unchanged when there are no identities", async () => {
    const original = { auth: null };
    const handler = withIdentityContext(() => original, resolverReturning({}));
    const result = await handler?.(inboundContext(), slackMessage());
    expect(result).toBe(original);
  });
});

describe("ignoreMessageEdit", () => {
  it("drops every edit", () => {
    expect(ignoreMessageEdit()).toBeNull();
  });

  it("fits eve's edit hook", () => {
    expectTypeOf(ignoreMessageEdit).toExtend<
      NonNullable<SlackChannelConfig["onMessageEdited"]>
    >();
  });
});

describe("createSlackChannel", () => {
  it("fails with setup guidance when SLACK_CONNECTOR is empty", () => {
    vi.stubEnv("SLACK_CONNECTOR", "");
    expect(() => createSlackChannel()).toThrow(
      "SLACK_CONNECTOR environment variable is not set. Set it to a value like 'slack/your-agent'."
    );
  });

  it("serves Slack events at the route the connector's trigger posts to", () => {
    vi.stubEnv("SLACK_CONNECTOR", "slack/memory-agent");
    const routes = createSlackChannel().routes.map((route) =>
      route.transport === "http" ? `${route.method} ${route.path}` : route
    );
    expect(routes).toStrictEqual(["POST /eve/v1/slack"]);
  });

  it("takes credentials from Vercel Connect, never from the caller", () => {
    expectTypeOf<CreateSlackChannelConfig>().not.toHaveProperty("credentials");
    expectTypeOf<ReturnType<typeof connectSlackCredentials>>().toExtend<
      NonNullable<SlackChannelConfig["credentials"]>
    >();
  });

  it("accepts eve's handlers for mentions, DMs, and messages", () => {
    expectTypeOf(handleExplicitInvocation).toExtend<
      NonNullable<SlackChannelConfig["onAppMention"]>
    >();
    expectTypeOf(handleExplicitInvocation).toExtend<
      NonNullable<SlackChannelConfig["onDirectMessage"]>
    >();
  });
});
