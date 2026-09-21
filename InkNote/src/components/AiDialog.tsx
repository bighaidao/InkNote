import { useEffect, useMemo, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { AiSelectionSnapshot } from "./Editor";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { describeAiError, generateAiText, providerPreset, type AiConfig } from "../lib/ai";
import { useModalEscape } from "../lib/useModalEscape";

type AiAction = "polish" | "summarize" | "translateZh" | "translateEn" | "explain" | "custom";

interface Props {
  locale: Locale;
  config: AiConfig;
  selection: AiSelectionSnapshot;
  readOnly: boolean;
  onApply: (result: string, insertBelow: boolean) => boolean;
  onClose: () => void;
}

const ACTIONS: AiAction[] = ["polish", "summarize", "translateZh", "translateEn", "explain", "custom"];

function instructionFor(action: AiAction, custom: string): string {
  switch (action) {
    case "polish": return "Polish the writing for clarity, fluency, and consistency while preserving meaning and Markdown structure.";
    case "summarize": return "Summarize the content concisely in Markdown. Preserve the language used by the source.";
    case "translateZh": return "Translate the content into natural Simplified Chinese while preserving Markdown structure.";
    case "translateEn": return "Translate the content into natural English while preserving Markdown structure.";
    case "explain": return "Explain the content clearly and accurately in the same language as the source, using Markdown when useful.";
    case "custom": return custom.trim();
  }
}

export default function AiDialog({ locale, config, selection, readOnly, onApply, onClose }: Props) {
  const [action, setAction] = useState<AiAction>("polish");
  const [customInstruction, setCustomInstruction] = useState("");
  const [result, setResult] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const aliveRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);
  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t(locale, key, vars);
  const instruction = useMemo(() => instructionFor(action, customInstruction), [action, customInstruction]);
  const provider = providerPreset(config.provider);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      requestRef.current?.abort();
    };
  }, []);
  const close = () => {
    requestRef.current?.abort();
    onClose();
  };
  useModalEscape(true, close);

  const generate = async () => {
    if (!instruction || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    setResult("");
    setReasoning("");
    setStopped(false);
    try {
      const text = await generateAiText({ config, instruction, content: selection.text, signal: controller.signal,
        onDelta: (delta) => {
          if (!aliveRef.current || controller.signal.aborted) return;
          if (delta.text) setResult((value) => value + delta.text);
          if (delta.reasoning) setReasoning((value) => value + delta.reasoning);
        },
      });
      if (aliveRef.current && !controller.signal.aborted) setResult(text);
    } catch (reason) {
      if (aliveRef.current && !controller.signal.aborted) setError(tr("ai.error", { message: describeAiError(locale, reason) }));
    } finally {
      if (aliveRef.current) setBusy(false);
      requestRef.current = null;
    }
  };

  const apply = (insertBelow: boolean) => {
    if (!result || busy) return;
    if (onApply(result, insertBelow)) onClose();
    else setError(tr("ai.documentChanged"));
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal ai-dialog" role="dialog" aria-modal="true" aria-label={tr("ai.title")} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header ai-dialog-header">
          <div>
            <h2>{tr("ai.title")}</h2>
            <p>{provider.name} · {config.model}</p>
          </div>
          <button type="button" className="settings-close" onClick={close} aria-label={tr("dialog.close")}>×</button>
        </div>
        <div className="modal-body ai-dialog-body">
          <div className="ai-scope-note">
            {selection.wholeDocument ? tr("ai.wholeDocument") : tr("ai.selection")}
            <span>{tr("ai.charCount", { n: selection.text.length.toLocaleString() })}</span>
          </div>
          <label className="ai-field">
            <span>{tr("ai.action")}</span>
            <select value={action} onChange={(event) => setAction(event.target.value as AiAction)} disabled={busy}>
              {ACTIONS.map((item) => <option key={item} value={item}>{tr(`ai.action.${item}` as Parameters<typeof t>[1])}</option>)}
            </select>
          </label>
          {action === "custom" && (
            <label className="ai-field">
              <span>{tr("ai.action.custom")}</span>
              <textarea
                rows={3}
                disabled={busy}
                value={customInstruction}
                placeholder={tr("ai.customInstruction")}
                onChange={(event) => setCustomInstruction(event.target.value)}
                autoFocus
              />
            </label>
          )}
          {!result && (
            <div className="ai-source-preview" title={selection.text}>{selection.text}</div>
          )}
          {reasoning && <details className="ai-reasoning" open={busy && !result}>
            <summary>{tr("ai.reasoning")}</summary>
            <p className="ai-notice">{tr("ai.reasoningNotice")}</p>
            <div>{reasoning}</div>
          </details>}
          {busy && <p className="ai-stream-status" role="status">{tr(result ? "ai.streaming" : reasoning ? "ai.thinking" : "ai.waiting")}</p>}
          {stopped && <p className="ai-notice" role="status">{tr("ai.stopped")}</p>}
          {result && (
            <label className="ai-field ai-result-field">
              <span>{tr("ai.result")}</span>
              <textarea value={result} readOnly={busy} onChange={(event) => setResult(event.target.value)} rows={12} />
            </label>
          )}
          {readOnly && result && <p className="ai-notice">{tr("ai.readOnly")}</p>}
          {error && <p className="ai-error" role="alert">{error}</p>}
          <div className="modal-actions ai-actions">
            <button type="button" className="btn-secondary" onClick={close}>{tr("dialog.cancel")}</button>
            {busy && <button type="button" className="btn-secondary" onClick={() => {
              requestRef.current?.abort();
              setStopped(true);
            }}>{tr("ai.stop")}</button>}
            {!result ? (
              <button type="button" className="btn-primary" onClick={() => void generate()} disabled={busy || !instruction}>
                {busy ? tr("ai.generating") : tr("ai.generate")}
              </button>
            ) : (
              <>
                <button type="button" className="btn-secondary" onClick={() => void writeText(result)}>{tr("ai.copy")}</button>
                <button type="button" className="btn-secondary" onClick={() => apply(true)} disabled={readOnly || busy}>{tr("ai.insertBelow")}</button>
                <button type="button" className="btn-primary" onClick={() => apply(false)} disabled={readOnly || busy}>{tr("ai.replace")}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
