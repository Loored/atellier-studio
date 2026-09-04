import { afterEach, describe, expect, it } from "vitest";
import { readRuntimeConfig } from "../runtime-config";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

describe("Ollama profile routing", () => {
  it.each([
    ["cheap", "qwen3.5:4b"],
    ["standard", "qwen3.5:9b"],
    ["deep", "gpt-oss:20b"],
  ])("selects the %s profile model", (profile, expectedModel) => {
    process.env.AGENT_EXECUTOR_MODE = "ollama";
    process.env.OLLAMA_MODEL_PROFILE = profile;
    process.env.OLLAMA_MODEL_CHEAP = "qwen3.5:4b";
    process.env.OLLAMA_MODEL_STANDARD = "qwen3.5:9b";
    process.env.OLLAMA_MODEL_DEEP = "gpt-oss:20b";
    process.env.OLLAMA_MODEL = "legacy-model";

    const config = readRuntimeConfig();

    expect(config.serviceOptions.ollamaModelProfile).toBe(profile);
    expect(config.serviceOptions.ollamaModel).toBe(expectedModel);
  });

  it("falls back to the legacy model when the selected profile is unset", () => {
    process.env.AGENT_EXECUTOR_MODE = "ollama";
    process.env.OLLAMA_MODEL_PROFILE = "standard";
    process.env.OLLAMA_MODEL_STANDARD = "";
    process.env.OLLAMA_MODEL = "legacy-model";

    expect(readRuntimeConfig().serviceOptions.ollamaModel).toBe("legacy-model");
  });

  it("uses a bounded Ollama context window for local Context Receipt runs", () => {
    delete process.env.OLLAMA_CONTEXT_TOKENS;
    expect(readRuntimeConfig().serviceOptions.ollamaContextTokens).toBe(8192);

    process.env.OLLAMA_CONTEXT_TOKENS = "invalid";
    expect(readRuntimeConfig().serviceOptions.ollamaContextTokens).toBe(8192);

    process.env.OLLAMA_CONTEXT_TOKENS = "12288";
    expect(readRuntimeConfig().serviceOptions.ollamaContextTokens).toBe(12288);
  });
});
