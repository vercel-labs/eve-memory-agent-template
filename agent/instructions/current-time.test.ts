import type { DynamicContext } from "eve/instructions";
import { describe, expect, expectTypeOf, it } from "vitest";

import { currentTimeReference, resolveCurrentTime } from "./current-time";

type Context = Parameters<typeof resolveCurrentTime>[0];

// Keeps one result per key, as eve's memo does within a session.
const session = () => {
  const saved = new Map<string, unknown>();
  const keys: unknown[] = [];
  const memo: Context["memo"] = async (key, run) => {
    keys.push(key);
    const id = JSON.stringify(key);
    if (!saved.has(id)) {
      saved.set(
        id,
        await run({
          abortSignal: new AbortController().signal,
          idempotencyKey: id,
        })
      );
    }
    // SAFETY: Each key stores the result of the callback it was first called with.
    return saved.get(id) as Awaited<ReturnType<typeof run>>;
  };
  const at = (turnId: string | null, now: string): Context => ({
    memo,
    now: new Date(now),
    turn: turnId === null ? null : { id: turnId, input: [], status: "running" },
  });
  return { at, keys, saved };
};

describe("currentTimeReference", () => {
  it("states the timestamp and its timezone", () => {
    expect(currentTimeReference("2026-11-16T00:30:00.000Z")).toBe(
      "Current date and time: 2026-11-16T00:30:00.000Z (UTC)."
    );
  });
});

describe("resolveCurrentTime", () => {
  it("returns user-role instructions with the turn's start time in UTC", async () => {
    const { at } = session();
    await expect(
      resolveCurrentTime(at("turn_0", "2026-11-16T11:30:00.000+11:00"))
    ).resolves.toMatchObject({
      content: "Current date and time: 2026-11-16T00:30:00.000Z (UTC).",
      role: "user",
    });
  });

  it("keeps one timestamp through every model call of a turn", async () => {
    const { at, saved } = session();
    const first = await resolveCurrentTime(
      at("turn_0", "2026-11-16T00:30:00.000Z")
    );
    const afterToolCall = await resolveCurrentTime(
      at("turn_0", "2026-11-16T00:30:45.000Z")
    );
    expect(afterToolCall.content).toBe(first.content);
    expect(saved.size).toBe(1);
  });

  it("records a new timestamp when the next turn starts", async () => {
    const { at } = session();
    const first = await resolveCurrentTime(
      at("turn_0", "2026-11-16T00:30:00.000Z")
    );
    const second = await resolveCurrentTime(
      at("turn_1", "2026-11-17T09:00:00.000Z")
    );
    expect(first.content).toContain("2026-11-16T00:30:00.000Z");
    expect(second.content).toContain("2026-11-17T09:00:00.000Z");
  });

  it("memoizes per turn with a JSON key and a JSON result", async () => {
    const { at, keys, saved } = session();
    await resolveCurrentTime(at("turn_7", "2026-11-16T00:30:00.000Z"));
    expect(keys).toStrictEqual([["turn-started", "turn_7"]]);
    expect([...saved.values()]).toStrictEqual(["2026-11-16T00:30:00.000Z"]);
  });

  it("resolves before a session's first turn", async () => {
    const { at, keys } = session();
    const result = await resolveCurrentTime(
      at(null, "2026-11-16T00:30:00.000Z")
    );
    expect(result.content).toContain("2026-11-16T00:30:00.000Z");
    expect(keys).toStrictEqual([["turn-started", null]]);
  });

  it("accepts the context eve passes to dynamic instructions", () => {
    expectTypeOf<DynamicContext>().toExtend<Context>();
  });
});
