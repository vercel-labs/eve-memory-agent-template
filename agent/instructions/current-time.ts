import { turn } from "eve/events";
import { defineDynamic, defineInstructions } from "eve/instructions";

/**
 * Appends a UTC time reference to conversation history as user-role instructions when each turn starts.
 *
 * @remarks
 * Previous timestamps remain unchanged, preserving the existing prompt
 * prefix for caching. The timestamp represents turn start, not a live clock.
 *
 * @param ctx - Current dynamic instruction context.
 * @returns User-role time instructions for the active turn, or null before one starts.
 */
export default defineDynamic((ctx) => {
  const startedAt = ctx.turn && turn(ctx.view, ctx.turn.id)?.startedAt;
  return startedAt
    ? defineInstructions({
        content: `Current date and time: ${startedAt} (UTC).`,
        role: "user",
      })
    : null;
});
