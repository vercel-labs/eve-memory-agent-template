import { defineDynamic, defineInstructions } from "eve/instructions";
import type { DynamicContext } from "eve/instructions";

/**
 * Builds the UTC time reference for the current turn.
 *
 * @param ctx - Dynamic context supplied by eve before each model call.
 * @returns A user-role instruction with the time the current turn started.
 * @remarks The timestamp is memoized per turn, so the content changes only when a new turn starts and eve appends it to history once per turn.
 */
const currentTime = async (ctx: DynamicContext) => {
  const startedAt = await ctx.memo(
    ["turn-started-at", ctx.turn?.id ?? null],
    () => new Date().toISOString()
  );
  return defineInstructions({
    content: `Current date and time: ${startedAt} (UTC).`,
    role: "user",
  });
};

/**
 * Appends a UTC time reference to conversation history as user-role instructions when each turn starts.
 *
 * @remarks
 * Previous timestamps remain unchanged, preserving the existing prompt
 * prefix for caching. The timestamp represents turn start, not a live clock.
 */
export default defineDynamic(currentTime);
