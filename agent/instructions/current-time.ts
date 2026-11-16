import { defineDynamic, defineInstructions } from "eve/instructions";
import type { DynamicContext } from "eve/instructions";

/**
 * Formats the time reference the model reads at the start of a turn.
 *
 * @param startedAt - UTC timestamp recorded when the turn started, in ISO 8601 form.
 * @returns The sentence added to the conversation as user-role instructions.
 */
export const currentTimeReference = (startedAt: string): string =>
  `Current date and time: ${startedAt} (UTC).`;

/**
 * Resolves the time reference for the turn in progress.
 *
 * @param ctx - Session details eve supplies before each model call.
 * @returns User-role instructions carrying the turn's start time.
 * @remarks
 * eve runs dynamic instructions before every model call, so the timestamp is
 * memoized per turn. It stays fixed through the turn's tool calls, which keeps
 * the prompt prefix stable for caching, and the next turn records a new one.
 * The timestamp is the time of the session's latest recorded event when the
 * turn starts, not a live clock.
 */
export const resolveCurrentTime = async (
  ctx: Pick<DynamicContext, "memo" | "now" | "turn">
) => {
  const startedAt = await ctx.memo(["turn-started", ctx.turn?.id ?? null], () =>
    ctx.now.toISOString()
  );
  return defineInstructions({
    content: currentTimeReference(startedAt),
    role: "user",
  });
};

/**
 * Appends a UTC time reference to conversation history as user-role instructions when each turn starts.
 *
 * @remarks Previous timestamps remain in history, so earlier turns keep the time they started at.
 */
export default defineDynamic(resolveCurrentTime);
