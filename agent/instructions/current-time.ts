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
export default defineDynamic(async (ctx) => {
  if (!ctx.turn) {
    return null;
  }
  const timestamp = await ctx.memo(["turn-started-at", ctx.turn.id], () =>
    new Date().toISOString()
  );
  return defineInstructions({
    content: `Current date and time: ${timestamp} (UTC).`,
    role: "user",
  });
});
