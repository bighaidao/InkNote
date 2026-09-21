import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiModelPicker from "./AiModelPicker";
import { getAiConfig, listAiModels } from "../lib/ai";

vi.mock("../lib/ai", async (original) => ({ ...await original<typeof import("../lib/ai")>(), listAiModels: vi.fn() }));
let root: Root;
beforeEach(() => vi.useFakeTimers());
afterEach(() => { act(() => root?.unmount()); document.body.replaceChildren(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("AI model selection", () => {
  it("fetches models with the entered key and lets the user select one", async () => {
    vi.mocked(listAiModels).mockResolvedValue(["model-a", "model-b"]);
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const change = vi.fn();
    act(() => root.render(<AiModelPicker locale="en" config={getAiConfig()} apiKey="draft-key" keyRevision={0} onChange={change} />));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(listAiModels).toHaveBeenCalledWith(expect.objectContaining({ provider: "deepseek" }), "draft-key");
    const select = host.querySelector("select")!;
    expect(select.disabled).toBe(false);
    expect([...select.options].map((option) => option.value)).toEqual(["", "model-a", "model-b"]);
    act(() => { select.value = "model-b"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(change).toHaveBeenLastCalledWith("model-b");
  });

  it("does not replace a new provider's models with an older response", async () => {
    let resolveOld!: (items: string[]) => void;
    vi.mocked(listAiModels).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce(["new-model"]);
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const config = getAiConfig();
    const render = (baseUrl: string) => act(() => root.render(<AiModelPicker locale="en" config={{ ...config, baseUrl }} apiKey="key" keyRevision={0} onChange={() => {}} />));
    render("https://old.example/v1");
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    render("https://new.example/v1");
    await act(async () => { await vi.advanceTimersByTimeAsync(600); resolveOld(["old-model"]); });
    expect(host.textContent).toContain("new-model");
    expect(host.textContent).not.toContain("old-model");
  });
});
