/**
 * Enables eve's built-in no_reply tool, so the agent can end a turn without posting.
 *
 * @remarks The Slack channel delivers thread replies that don't mention the agent and message edits as deferred turns; the agent calls `no_reply` when one isn't meant for it.
 */
export { noReply as default } from "eve/tools/no_reply";
