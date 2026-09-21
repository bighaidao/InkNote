import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { AI_PROVIDERS, configForProvider, describeAiError, generateAiText, getAiConfig, saveAiConfig } from "./ai";
import { resetSettingsStoreForTests, setStoredValue } from "./settingsStore";

beforeEach(() => resetSettingsStoreForTests());
afterEach(() => { clearMocks(); vi.useRealTimers(); });

describe("AI request cancellation", () => {
  it("cancels the matching backend request when the dialog closes", async () => {
    const ipc = vi.fn((command: string) => command === "generate_ai_text" ? new Promise(() => {}) : undefined);
    mockIPC(ipc);
    const controller = new AbortController();
    const result = generateAiText({ config: getAiConfig(), instruction: "Polish", content: "Text", signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toThrow("ai_cancelled");
    const requestId = (ipc.mock.calls[0] as unknown as [string, { requestId: string }])[1].requestId;
    expect(ipc).toHaveBeenCalledWith("cancel_ai_request", { requestId });
  });

  it("times out and cancels requests that never settle", async () => {
    vi.useFakeTimers();
    const ipc = vi.fn((command: string) => command === "generate_ai_text" ? new Promise(() => {}) : undefined);
    mockIPC(ipc);
    const result = generateAiText({ config: getAiConfig(), instruction: "Polish", content: "Text" });
    const assertion = expect(result).rejects.toThrow("ai_request_timeout");
    await vi.advanceTimersByTimeAsync(605_000);
    await assertion;
    expect(ipc).toHaveBeenCalledWith("cancel_ai_request", expect.anything());
  });
});

describe("AI settings", () => {
  it("is disabled by default and starts with a usable provider", () => {
    const config = getAiConfig();
    expect(config.enabled).toBe(false);
    expect(config.provider).toBe("deepseek");
    expect(config.baseUrl).toMatch(/^https:/);
    expect(config.model).not.toBe("");
    expect(config.maxTokens).toBe(32768);
  });

  it("upgrades the old output default without overriding subsequent manual choices", () => {
    setStoredValue("mdnote.aiMaxTokens", "4096");
    expect(getAiConfig().maxTokens).toBe(32768);
    saveAiConfig({ ...getAiConfig(), maxTokens: 4096 });
    expect(getAiConfig().maxTokens).toBe(4096);
  });

  it("preserves other saved output limits", () => {
    setStoredValue("mdnote.aiMaxTokens", "16384");
    expect(getAiConfig().maxTokens).toBe(16384);
  });

  it("keeps provider identifiers unique and includes domestic, global, local, and custom options", () => {
    expect(new Set(AI_PROVIDERS.map((provider) => provider.id)).size).toBe(AI_PROVIDERS.length);
    expect(AI_PROVIDERS.map((provider) => provider.id)).toEqual(expect.arrayContaining([
      "deepseek", "zhipu", "qwen", "moonshot", "doubao", "siliconflow",
      "hunyuan", "qianfan", "spark",
      "openai", "anthropic", "gemini", "ollama", "custom",
    ]));
  });

  it("persists editable provider settings without storing an API key", () => {
    const custom = configForProvider(getAiConfig(), "custom");
    saveAiConfig({ ...custom, enabled: true, baseUrl: "https://example.com/v1", model: "my-model" });
    expect(getAiConfig()).toMatchObject({
      enabled: true,
      provider: "custom",
      baseUrl: "https://example.com/v1",
      model: "my-model",
    });
  });

  it("turns backend error codes into user-facing messages", () => {
    expect(describeAiError("en", "ai_key_missing")).toContain("API key");
    expect(describeAiError("zh", "ai_http_429")).toContain("额度");
  });
});
