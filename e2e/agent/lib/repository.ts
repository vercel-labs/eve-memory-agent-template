import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT_MARKER = "pnpm-workspace.yaml";

const findRepositoryRoot = (from: string): string => {
  const parent = path.dirname(from);
  if (existsSync(path.join(from, ROOT_MARKER))) {
    return from;
  }
  if (parent === from) {
    throw new Error(`Could not find ${ROOT_MARKER} above the e2e fixture.`);
  }
  return findRepositoryRoot(parent);
};

/**
 * Reads a file from the template repository, wherever eve compiled this module to.
 *
 * @param file - Path relative to the repository root, such as `agent/instructions.md`.
 * @returns The file's UTF-8 text.
 * @throws {@link Error} When no repository root sits above this module.
 * @remarks eve evaluates fixture modules from a build cache, so the root is found by walking up to the pnpm workspace file instead of resolving a relative path.
 */
export const readRepositoryFile = (file: string): string =>
  readFileSync(
    path.join(findRepositoryRoot(import.meta.dirname), file),
    "utf-8"
  );
