import type { SessionUsageLimit } from "eve";

/**
 * Input tokens one session may send before eve pauses it and asks whether to continue.
 */
export const SESSION_INPUT_TOKEN_BUDGET = 300_000;

/**
 * Decides whether a session has used its input budget since the last approved continuation.
 *
 * @param usage - Session usage supplied by eve before each model call. Only `window`, the usage since the session started or was last continued, is read.
 * @returns Whether eve must pause the session before its next model call.
 * @remarks Counts every input token the provider reports, including history replayed from its prompt cache, so a long thread reaches the budget sooner than its length suggests.
 */
export const exceedsSessionInputBudget: SessionUsageLimit = (usage) =>
  usage.window.inputTokens >= SESSION_INPUT_TOKEN_BUDGET;
