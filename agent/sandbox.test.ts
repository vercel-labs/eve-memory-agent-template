import type { SandboxSelectorContext } from "eve/sandbox";
import { describe, expect, it, vi } from "vitest";

const context: SandboxSelectorContext = {
  session: {
    auth: { current: null, initiator: null },
    id: "session-1",
    turn: { id: "turn_0", sequence: 0 },
  },
};

// The module reads VERCEL once when it loads, so each test loads a fresh copy.
// open() is stopped with a marker error, which shows the selector hands back
// whatever open() settles with and keeps the tests from starting a sandbox.
const loadSandbox = async (vercel: string | undefined) => {
  vi.resetModules();
  vi.stubEnv("VERCEL", vercel);
  const sandbox = await import("./sandbox");
  const open = vi
    .spyOn(sandbox.environment, "open")
    .mockRejectedValue(new Error("open() was reached"));
  return { open, sandbox };
};

describe("sandbox", () => {
  it.each([undefined, "", "0", "true"])(
    "uses just-bash with no network policy when VERCEL is %j",
    async (vercel) => {
      const { open, sandbox } = await loadSandbox(vercel);
      expect(sandbox.environment.provider).toBe("just-bash");
      await expect(sandbox.default(context)).rejects.toThrow(
        "open() was reached"
      );
      expect(open).toHaveBeenCalled();
      for (const [options] of open.mock.calls) {
        expect(options ?? {}).not.toHaveProperty("networkPolicy");
      }
    }
  );

  it("uses Vercel Sandbox and denies outbound network access on every open when deployed", async () => {
    const { open, sandbox } = await loadSandbox("1");
    expect(sandbox.environment.provider).toBe("vercel");
    await expect(sandbox.default(context)).rejects.toThrow(
      "open() was reached"
    );
    expect(open).toHaveBeenCalled();
    // Holds for a selector that retries, such as one that mounts a Drive and falls back.
    for (const [options] of open.mock.calls) {
      expect(options).toMatchObject({ networkPolicy: "deny-all" });
    }
  });
});
