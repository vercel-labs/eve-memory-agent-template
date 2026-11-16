import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const root = path.join(import.meta.dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf-8");
const packageSchema = z.object({
  dependencies: z.object({ eve: z.string() }),
});
const readPackage = (file: string) =>
  packageSchema.parse(JSON.parse(read(file)));

// Agent source files eve loads, with paths relative to agent/.
const sources = (directory: string): string[] =>
  readdirSync(path.join(root, "agent", directory), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts")
    )
    .map((entry) => path.posix.join(directory, entry.name));

describe("e2e fixture agent", () => {
  it.each([
    ...sources("memory"),
    ...sources("tools"),
    ...sources("instructions"),
    "sandbox.ts",
    "channels/eve.ts",
  ])(
    "re-exports agent/%s, so the tests run the template's own module",
    (file) => {
      const fixture = path.join("e2e/agent", file);
      expect(
        existsSync(path.join(root, fixture)),
        `Add ${fixture} that re-exports agent/${file}, so the end-to-end tests cover it.`
      ).toBe(true);
      const target = path.posix
        .relative(path.posix.dirname(fixture), path.posix.join("agent", file))
        .replace(/\.ts$/u, "");
      expect(read(fixture)).toContain(`from "${target}";`);
    }
  );

  it("adds no memory slots or tools of its own", () => {
    for (const directory of ["memory", "tools"]) {
      expect(
        readdirSync(path.join(root, "e2e/agent", directory)).toSorted()
      ).toStrictEqual(
        sources(directory)
          .map((file) => path.posix.basename(file))
          .toSorted()
      );
    }
  });

  it("depends on the same eve range as the template", () => {
    expect(readPackage("e2e/package.json").dependencies.eve).toBe(
      readPackage("package.json").dependencies.eve
    );
  });
});

describe("configuration", () => {
  it("documents every environment variable the agent reads in .env.example", () => {
    const code = [
      ...sources("lib/integrations/slack"),
      ...sources("lib/memory"),
      ...sources("lib/utils"),
      ...sources("memory"),
      ...sources("channels"),
      "agent.ts",
      "sandbox.ts",
    ]
      .map((file) => read(path.join("agent", file)))
      .join("\n");
    const names = new Set(
      [
        ...code.matchAll(
          /process\.env\.(?<property>[A-Z0-9_]+)|requireEnv\("(?<required>[A-Z0-9_]+)"/gu
        ),
      ].map((match) => match.groups?.property ?? match.groups?.required)
    );
    // Vercel sets VERCEL on deployments; nobody configures it by hand.
    names.delete("VERCEL");
    expect([...names].toSorted()).toStrictEqual([
      "SLACK_CONNECTOR",
      "SLACK_IDENTITY_EXCLUDED_USER_IDS",
    ]);
    const example = read(".env.example");
    for (const name of names) {
      expect(example).toMatch(new RegExp(`^${name}=`, "mu"));
    }
  });
});
