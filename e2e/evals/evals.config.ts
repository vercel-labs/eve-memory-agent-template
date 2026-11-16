import { defineEvalConfig } from "eve/evals";

/**
 * Runs the end-to-end checks one at a time, because local sessions share one memory scope.
 */
export default defineEvalConfig({ maxConcurrency: 1 });
