/**
 * Typed memory-scope fixtures for unit tests, built against eve's public
 * memory types so an eve upgrade that changes them fails typecheck.
 *
 * @packageDocumentation
 */
import type { MemoryScopeContext } from "eve/memory";

/**
 * Authenticated caller of a session, or null for an unauthenticated one.
 */
export type Caller = MemoryScopeContext["session"]["auth"]["current"];

/**
 * Builds the principal eve's Slack channel derives for a human user.
 *
 * @param overrides - Principal fields to replace for the scenario under test.
 * @returns A Slack webhook user in workspace T123 speaking from channel C123.
 */
export const slackCaller = (
  overrides: Partial<NonNullable<Caller>> = {}
): NonNullable<Caller> => ({
  attributes: { channel_id: "C123", team_id: "T123", user_id: "U123" },
  authenticator: "slack-webhook",
  issuer: "slack:T123",
  principalId: "slack:T123:U123",
  principalType: "user",
  ...overrides,
});

/**
 * The principal eve assigns to every caller during local development.
 */
export const localDevCaller: NonNullable<Caller> = {
  attributes: {},
  authenticator: "local-dev",
  principalId: "local-dev",
  principalType: "local-dev",
};

/**
 * Builds the context eve passes to a memory scope resolver.
 *
 * @param current - Caller of the current turn, who also started the session.
 * @returns A scope context for a Slack session.
 */
export const memoryScopeContext = (current: Caller): MemoryScopeContext => ({
  abortSignal: new AbortController().signal,
  channel: { kind: "channel:slack", metadata: {} },
  session: { auth: { current, initiator: current }, id: "session-1" },
});
