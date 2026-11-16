import { disableTool } from "eve/tools";
import { describe, expect, it } from "vitest";

// eve names a tool after its file, so each import path is the built-in it overrides.
import agent from "./agent";
import editFile from "./edit_file";
import webFetch from "./web_fetch";
import webSearch from "./web_search";
import writeFile from "./write_file";

describe("built-in tool overrides", () => {
  it.each([
    ["agent", agent],
    ["edit_file", editFile],
    ["web_fetch", webFetch],
    ["web_search", webSearch],
    ["write_file", writeFile],
  ])("disables %s", (_name, override) => {
    expect(override).toStrictEqual(disableTool());
  });
});
