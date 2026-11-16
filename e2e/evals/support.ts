import { SCRIPT_PREFIX, snapshotSchema } from "../agent/lib/scripted-model";
import type { ModelSnapshot, ScriptStep } from "../agent/lib/scripted-model";

/**
 * Builds a user message that makes the fixture model play the given steps.
 *
 * @param steps - Model responses to play in order, one per model call in the turn.
 * @returns The message to send to the agent.
 */
export const script = (...steps: ScriptStep[]): string =>
  `${SCRIPT_PREFIX}${JSON.stringify(steps)}`;

/**
 * Reads the snapshot the fixture model replied with.
 *
 * @param reply - Final reply of a turn whose script has run out of steps.
 * @returns What eve gave the model for that turn's last call.
 * @throws {@link Error} When the reply isn't a snapshot.
 */
export const snapshotOf = (reply: string | null | undefined): ModelSnapshot =>
  snapshotSchema.parse(JSON.parse(reply ?? ""));
