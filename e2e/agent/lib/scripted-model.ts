import type { mockModel } from "eve/evals";
import { z } from "zod";

type Responder = Extract<
  Parameters<typeof mockModel>[0],
  (request: never) => object | string
>;

/**
 * Marks a user message as a script for the fixture model to act out.
 */
export const SCRIPT_PREFIX = "script:";

const stepSchema = z
  .object({
    text: z.string().optional(),
    toolCalls: z
      .array(z.object({ input: z.unknown().optional(), name: z.string() }))
      .min(1)
      .optional(),
    usage: z
      .object({
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
      })
      .optional(),
  })
  .refine((step) => step.text !== undefined || step.toolCalls !== undefined, {
    message: "A script step needs text or tool calls.",
  });

/**
 * One model response in a script: text, tool calls, and the token usage to report.
 */
export type ScriptStep = z.infer<typeof stepSchema>;

/**
 * Parses what the fixture model replies with once a script runs out of steps.
 */
export const snapshotSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["assistant", "system", "tool", "user"]),
      text: z.string(),
    })
  ),
  toolResults: z.array(
    z.object({ isError: z.boolean(), name: z.string(), output: z.unknown() })
  ),
  tools: z.array(
    z.object({ description: z.string().optional(), name: z.string() })
  ),
});

/**
 * Everything eve handed the model for one call: the prompt, earlier tool results, and the available tools.
 */
export type ModelSnapshot = z.infer<typeof snapshotSchema>;

/**
 * Stands in for the model so tests can drive the agent without a provider.
 *
 * @param request - The prompt, tools, and tool results eve prepared for this model call.
 * @returns The next scripted step, or a JSON {@link ModelSnapshot} of the request.
 * @throws {@link Error} When a script is malformed or its message isn't in the prompt.
 * @remarks
 * A user message starting with {@link SCRIPT_PREFIX} carries a JSON array of
 * steps, and each model call in that turn plays the next one. Any other
 * message, and a script with no steps left, gets the snapshot, which shows a
 * test exactly what the real model would have been given.
 */
export const respond: Responder = ({
  lastUserMessage,
  messages,
  toolResults,
  tools,
}) => {
  const snapshot: ModelSnapshot = {
    messages: messages.map(({ role, text }) => ({ role, text })),
    toolResults: toolResults.map(({ isError, name, output }) => ({
      isError,
      name,
      output,
    })),
    tools: tools.map(({ description, name }) => ({ description, name })),
  };
  if (!lastUserMessage?.startsWith(SCRIPT_PREFIX)) {
    return JSON.stringify(snapshot);
  }
  const steps = z
    .array(stepSchema)
    .parse(JSON.parse(lastUserMessage.slice(SCRIPT_PREFIX.length)));
  const scriptIndex = messages.findLastIndex(
    (message) => message.role === "user" && message.text === lastUserMessage
  );
  if (scriptIndex === -1) {
    throw new Error("The script message is missing from the model's prompt.");
  }
  const stepsTaken = messages
    .slice(scriptIndex + 1)
    .filter((message) => message.role === "assistant").length;
  return steps[stepsTaken] ?? JSON.stringify(snapshot);
};
