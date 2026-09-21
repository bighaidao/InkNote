import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import AiDialog from "./AiDialog";
import { generateAiText, getAiConfig } from "../lib/ai";

vi.mock("../lib/ai", async (original) => ({ ...await original<typeof import("../lib/ai")>(), generateAiText: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn() }));
let root: Root;
afterEach(() => { act(() => root?.unmount()); document.body.replaceChildren(); vi.clearAllMocks(); });

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const close = vi.fn();
  act(() => root.render(<StrictMode><AiDialog locale="en" config={getAiConfig()}
    selection={{ text: "Source", from: 0, to: 6, wholeDocument: true }}
    readOnly={false} onApply={() => true} onClose={close} /></StrictMode>));
  return { host, close };
}

describe("AI dialog lifecycle", () => {
  it("renders streamed reasoning and text before completion and preserves text on stop", async () => {
    vi.mocked(generateAiText).mockImplementation(({ signal }) => new Promise((_, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("ai_cancelled")), { once: true });
    }));
    const { host, close } = mount();
    await act(async () => { host.querySelector<HTMLButtonElement>(".btn-primary")!.click(); });
    const input = vi.mocked(generateAiText).mock.calls[0][0];
    act(() => input.onDelta?.({ text: "", reasoning: "Thinking summary" }));
    expect(host.querySelector("details")?.textContent).toContain("Thinking summary");
    act(() => input.onDelta?.({ text: "Partial answer", reasoning: "" }));
    expect(host.querySelector("textarea")?.value).toBe("Partial answer");
    expect(host.querySelector("textarea")?.readOnly).toBe(true);
    expect(host.querySelector<HTMLButtonElement>(".btn-primary")?.disabled).toBe(true);
    const stop = [...host.querySelectorAll("button")].find((button) => button.textContent === "Stop generating")!;
    await act(async () => stop.click());
    expect(input.signal?.aborted).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(host.querySelector("textarea")?.value).toBe("Partial answer");
    expect(host.querySelector("textarea")?.readOnly).toBe(false);
    act(() => input.onDelta?.({ text: "Late chunk", reasoning: "" }));
    expect(host.querySelector("textarea")?.value).toBe("Partial answer");
  });

  it("shows completed results under StrictMode", async () => {
    vi.mocked(generateAiText).mockResolvedValue("Polished result");
    const { host } = mount();
    await act(async () => { host.querySelector<HTMLButtonElement>(".btn-primary")!.click(); });
    expect(host.querySelector("textarea")?.value).toBe("Polished result");
  });

  it("shows failures and enables retry under StrictMode", async () => {
    vi.mocked(generateAiText).mockRejectedValue("ai_request_timeout");
    const { host } = mount();
    await act(async () => { host.querySelector<HTMLButtonElement>(".btn-primary")!.click(); });
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();
    expect(host.querySelector<HTMLButtonElement>(".btn-primary")!.disabled).toBe(false);
  });

  it("allows closing and aborts an in-flight request", async () => {
    vi.mocked(generateAiText).mockImplementation(() => new Promise(() => {}));
    const { host, close } = mount();
    await act(async () => { host.querySelector<HTMLButtonElement>(".btn-primary")!.click(); });
    act(() => host.querySelector<HTMLButtonElement>(".settings-close")!.click());
    expect(close).toHaveBeenCalledOnce();
    expect(vi.mocked(generateAiText).mock.calls[0][0].signal?.aborted).toBe(true);
  });
});
