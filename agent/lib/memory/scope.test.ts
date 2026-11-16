import type { MemoryScopeDefinition } from "eve/memory";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  localDevCaller,
  memoryScopeContext,
  slackCaller,
} from "../testing/memory";
import type { Caller } from "../testing/memory";
import { bySlackChannel } from "./scope";

const scopeFor = (current: Caller) =>
  bySlackChannel(memoryScopeContext(current));

describe("bySlackChannel", () => {
  it("scopes Slack users to their installation and channel", () => {
    expect(scopeFor(slackCaller())).toStrictEqual([
      "slack-channel",
      "slack:T123",
      "C123",
    ]);
  });

  it("shares one scope across users in the same channel", () => {
    expect(
      scopeFor(
        slackCaller({
          attributes: { channel_id: "C123", user_id: "U456" },
          principalId: "slack:T123:U456",
        })
      )
    ).toStrictEqual(scopeFor(slackCaller()));
  });

  it("accepts private channels", () => {
    expect(
      scopeFor(slackCaller({ attributes: { channel_id: "G123" } }))
    ).toStrictEqual(["slack-channel", "slack:T123", "G123"]);
  });

  it("uses the shared local-dev scope during local development", () => {
    expect(scopeFor(localDevCaller)).toBe("local-dev");
  });

  it("keeps the same channel ID separate across Slack workspaces", () => {
    const first = scopeFor(slackCaller());
    const second = scopeFor(
      slackCaller({ issuer: "slack:T999", principalId: "slack:T999:U123" })
    );
    expect(first).toStrictEqual(["slack-channel", "slack:T123", "C123"]);
    expect(second).toStrictEqual(["slack-channel", "slack:T999", "C123"]);
  });

  it("is a scope resolver eve's memory slots accept", () => {
    expectTypeOf(bySlackChannel).toExtend<MemoryScopeDefinition>();
  });

  it("never falls back to a channel named in the session's channel metadata", () => {
    expect(
      bySlackChannel({
        ...memoryScopeContext(slackCaller({ attributes: {} })),
        channel: { kind: "channel:slack", metadata: { channel_id: "C999" } },
      })
    ).toBeNull();
  });

  it.each(["c123", "C", "W123", "U123", "", "C123\n", "C-123"])(
    "disables memory for the malformed channel ID %j",
    (channelId) => {
      expect(
        scopeFor(slackCaller({ attributes: { channel_id: channelId } }))
      ).toBeNull();
    }
  );

  it.each([
    ["anonymous callers", null],
    ["DMs", slackCaller({ attributes: { channel_id: "D123" } })],
    ["missing channels", slackCaller({ attributes: {} })],
    [
      "array channel attributes",
      slackCaller({ attributes: { channel_id: ["C123"] } }),
    ],
    ["bots", slackCaller({ principalType: "service" })],
    ["missing issuers", slackCaller({ issuer: undefined })],
    ["issuers without a workspace", slackCaller({ issuer: "slack" })],
    ["anonymous Slack principals", slackCaller({ principalType: "anonymous" })],
    ["runtime Slack principals", slackCaller({ principalType: "runtime" })],
    ["non-Slack authenticators", slackCaller({ authenticator: "vercel-oidc" })],
  ])("disables memory for %s", (_name, caller) => {
    expect(scopeFor(caller)).toBeNull();
  });
});
