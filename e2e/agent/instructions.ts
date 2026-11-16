import { defineInstructions } from "eve/instructions";

import { readRepositoryFile } from "./lib/repository";

/**
 * Loads the template's system instructions, so the fixture agent reads the same prompt as the real one.
 */
export default defineInstructions({
  content: readRepositoryFile("agent/instructions.md"),
});
