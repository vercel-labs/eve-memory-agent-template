import { connectSlackCredentials } from "@vercel/connect/eve";
import { defaultSlackAuth, slackChannel } from "eve/channels/slack";
import type {
  SlackChannelConfig,
  SlackInboundMessageContext,
  SlackInboundResult,
  SlackMessage,
} from "eve/channels/slack";

import { requireEnv } from "../../utils/env";
import {
  createSlackIdentityResolver,
  formatSlackIdentityContext,
} from "./identity";

/**
 * Native Slack channel settings with shared identity enrichment.
 */
export type CreateSlackChannelConfig = Omit<SlackChannelConfig, "credentials">;

type InboundHandler = NonNullable<SlackChannelConfig["onMessage"]>;

/**
 * Starts a turn for a human-authored mention or DM using eve's Slack identity.
 *
 * @param ctx - Verified inbound webhook context supplied by eve.
 * @param message - Slack message carrying user, workspace, channel, and thread identifiers.
 * @returns eve's authenticated Slack principal with an empty `history`, or null to drop the message.
 * @remarks
 * Bots, the agent itself, and messages without a verified author are dropped,
 * so no message falls back to a shared principal. The empty `history` keeps
 * earlier thread replies in eve's attributed transcript. Without it, eve
 * replays them as conversation turns when a mention starts a session, and
 * another person's earlier request reads like one from the current sender.
 */
export const handleExplicitInvocation = (
  ctx: SlackInboundMessageContext,
  message: SlackMessage
): SlackInboundResult => {
  if (message.author?.isMe || message.author?.isBot) {
    return null;
  }
  const auth = defaultSlackAuth(message, ctx);
  return auth ? { auth, history: [] } : null;
};

/**
 * Chooses the mention, DM, and message handlers while preserving eve's handler precedence.
 *
 * @param handlers - Caller-supplied handlers, any of which may be omitted.
 * @returns The handlers to register.
 * @remarks Mentions and DMs default to {@link handleExplicitInvocation} only when the caller supplies no `onMessage`, because eve gives the specific handlers precedence over `onMessage`.
 */
export const selectInboundHandlers = ({
  onAppMention,
  onDirectMessage,
  onMessage,
}: Partial<
  Pick<SlackChannelConfig, "onAppMention" | "onDirectMessage" | "onMessage">
>) => {
  const fallback = onMessage ? undefined : handleExplicitInvocation;
  return {
    onAppMention: onAppMention ?? fallback,
    onDirectMessage: onDirectMessage ?? fallback,
    onMessage,
  };
};

/**
 * Drops a person's edit to an earlier message, so an edit never starts another turn.
 *
 * @returns Always null, which tells eve to ignore the edit.
 * @remarks eve otherwise sends edits through the mention and DM handlers, and the agent replies to each one. Pass `onMessageEdited` to {@link createSlackChannel} to deliver edits instead.
 */
export const ignoreMessageEdit = (): SlackInboundResult => null;

/**
 * Wraps an inbound handler so accepted messages carry Slack profile context.
 *
 * @param handler - Handler that decides whether a message starts a turn.
 * @param resolveIdentities - Resolver for the sender, mentions, and thread participants.
 * @returns A handler that appends the identity block to any existing context, or undefined when no handler is given.
 */
export const withIdentityContext = (
  handler: SlackChannelConfig["onMessage"],
  resolveIdentities: ReturnType<typeof createSlackIdentityResolver>
): SlackChannelConfig["onMessage"] => {
  if (!handler) {
    return undefined;
  }
  const wrapped: InboundHandler = async (ctx, message) => {
    const result = await handler(ctx, message);
    if (!result) {
      return null;
    }
    const identities = await resolveIdentities(ctx, message);
    const identityContext = formatSlackIdentityContext(message, identities);
    return identityContext
      ? { ...result, context: [...(result.context ?? []), identityContext] }
      : result;
  };
  return wrapped;
};

/**
 * Builds the native Slack channel configuration: Connect credentials, identity-enriched handlers, and the template's defaults.
 *
 * @param config - Native channel overrides.
 * @returns The configuration passed to eve's Slack channel.
 * @throws {@link Error} When SLACK_CONNECTOR is missing.
 * @remarks Thread history defaults to messages since the agent's last reply, and edits to earlier messages are ignored unless `onMessageEdited` is supplied.
 */
export const resolveSlackChannelConfig = (
  config: CreateSlackChannelConfig = {}
): SlackChannelConfig => {
  const {
    onMessage,
    onAppMention,
    onDirectMessage,
    onMessageEdited = ignoreMessageEdit,
    threadContext = { since: "last-agent-reply" },
    ...channelConfig
  } = config;
  const resolveIdentities = createSlackIdentityResolver(threadContext);
  const handlers = selectInboundHandlers({
    onAppMention,
    onDirectMessage,
    onMessage,
  });

  return {
    ...channelConfig,
    credentials: connectSlackCredentials(
      requireEnv("SLACK_CONNECTOR", "slack/your-agent")
    ),
    onAppMention: withIdentityContext(handlers.onAppMention, resolveIdentities),
    onDirectMessage: withIdentityContext(
      handlers.onDirectMessage,
      resolveIdentities
    ),
    onMessage: withIdentityContext(handlers.onMessage, resolveIdentities),
    onMessageEdited,
    threadContext,
  };
};

/**
 * Creates the Slack channel using credentials from the configured Vercel Connect connector.
 *
 * @param config - Native channel overrides.
 * @returns A channel definition whose inbound turns carry Slack profile context.
 * @throws {@link Error} When SLACK_CONNECTOR is missing.
 * @remarks Export this definition from agent/channels/slack.ts to retain the slack runtime name. See {@link resolveSlackChannelConfig} for the defaults it applies.
 */
export const createSlackChannel = (config: CreateSlackChannelConfig = {}) =>
  slackChannel(resolveSlackChannelConfig(config));
