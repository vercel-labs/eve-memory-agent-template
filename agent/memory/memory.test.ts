import type { MemoryScopeContext } from "eve/memory";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  localDevCaller,
  memoryScopeContext,
  slackCaller,
} from "../lib/testing/memory";
import type { Caller } from "../lib/testing/memory";
import channelPreferences from "./channel-preferences";
import userPreferences from "./user-preferences";

// The scope eve stores for a Slack user: principal type, authenticator, workspace issuer, and user.
const SLACK_USER_SCOPE = JSON.stringify([
  "user",
  "slack-webhook",
  "slack:T123",
  "slack:T123:U123",
]);

const userScope = (current: Caller) =>
  userPreferences.scope(memoryScopeContext(current));
const channelScope = (current: Caller) =>
  channelPreferences.scope(memoryScopeContext(current));

describe("memory slots", () => {
  it("uses the default namespace, so existing memories stay reachable", () => {
    expect(userPreferences).not.toHaveProperty("namespace");
    expect(channelPreferences).not.toHaveProperty("namespace");
  });

  it("describes what each slot holds and points personal preferences away from channel memory", () => {
    expect(userPreferences.description).toContain("user's stable preferences");
    expect(channelPreferences.description).toContain("current Slack channel");
    expect(channelPreferences.description).toContain(
      "Save individual users' preferences to user memory instead."
    );
    expect(userPreferences.description).not.toBe(
      channelPreferences.description
    );
  });

  it("declares scope resolvers that take eve's scope context", () => {
    expectTypeOf(userPreferences.scope)
      .parameter(0)
      .toEqualTypeOf<MemoryScopeContext>();
    expectTypeOf(channelPreferences.scope)
      .parameter(0)
      .toEqualTypeOf<MemoryScopeContext>();
  });
});

describe("memory scopes", () => {
  it("follows one Slack user across channels and DMs", () => {
    const inChannel = userScope(slackCaller());
    const inDirectMessage = userScope(
      slackCaller({ attributes: { channel_id: "D123", user_id: "U123" } })
    );
    expect(inChannel).toBe(SLACK_USER_SCOPE);
    expect(inDirectMessage).toBe(inChannel);
  });

  it("separates users in the same channel, who still share channel memory", () => {
    const second = slackCaller({ principalId: "slack:T123:U456" });
    expect(userScope(second)).not.toBe(userScope(slackCaller()));
    expect(channelScope(second)).toStrictEqual(channelScope(slackCaller()));
  });

  it("separates the same user ID in different Slack workspaces", () => {
    const elsewhere = slackCaller({
      issuer: "slack:T999",
      principalId: "slack:T999:U123",
    });
    expect(userScope(elsewhere)).not.toBe(userScope(slackCaller()));
  });

  it("scopes channel memory to the workspace and channel, not the speaker", () => {
    expect(channelScope(slackCaller())).toStrictEqual([
      "slack-channel",
      "slack:T123",
      "C123",
    ]);
  });

  it.each([
    ["unauthenticated callers", null],
    ["anonymous callers", slackCaller({ principalType: "anonymous" })],
    ["runtime callers", slackCaller({ principalType: "runtime" })],
  ])("disables user memory for %s", (_name, caller) => {
    expect(userScope(caller)).toBeNull();
  });

  it("shares one local-dev scope across both slots during local development", () => {
    expect(userScope(localDevCaller)).toBe("local-dev");
    expect(channelScope(localDevCaller)).toBe("local-dev");
  });

  it("keeps user memory in a DM, where channel memory is disabled", () => {
    const inDirectMessage = slackCaller({
      attributes: { channel_id: "D123", user_id: "U123" },
    });
    expect(userScope(inDirectMessage)).toBe(SLACK_USER_SCOPE);
    expect(channelScope(inDirectMessage)).toBeNull();
  });
});
