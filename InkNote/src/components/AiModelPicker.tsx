import { useEffect, useRef, useState } from "react";
import { describeAiError, listAiModels, type AiConfig } from "../lib/ai";
import { t, type Locale } from "../lib/i18n";

interface Props {
  locale: Locale;
  config: AiConfig;
  apiKey: string;
  keyRevision: number;
  onChange: (model: string) => void;
}

export default function AiModelPicker({ locale, config, apiKey, keyRevision, onChange }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const current = useRef({ config, onChange });
  current.current = { config, onChange };

  useEffect(() => {
    let disposed = false;
    setModels([]);
    setError("");
    setLoading(Boolean(config.baseUrl.trim()));
    if (!config.baseUrl.trim()) return;
    const timer = setTimeout(() => {
      void listAiModels(current.current.config, apiKey)
        .then((items) => {
          if (disposed) return;
          setModels(items);
          if (!items.includes(current.current.config.model)) current.current.onChange("");
        })
        .catch((reason) => { if (!disposed) setError(describeAiError(locale, reason)); })
        .finally(() => { if (!disposed) setLoading(false); });
    }, 600);
    return () => { disposed = true; clearTimeout(timer); };
  }, [config.provider, config.baseUrl, config.protocol, apiKey, keyRevision, refresh, locale]);

  return <div className="ai-model-picker">
    <div className="settings-inline-actions">
      <select aria-label={t(locale, "settings.aiModel")}
        value={models.includes(config.model) ? config.model : ""}
        disabled={loading || !models.length} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>{t(locale, loading ? "ai.modelsLoading" : "ai.modelsChoose")}</option>
        {models.map((model) => <option key={model} value={model}>{model}</option>)}
      </select>
      <button type="button" className="settings-text-btn" disabled={loading || !config.baseUrl.trim()}
        onClick={() => setRefresh((value) => value + 1)}>{t(locale, "ai.modelsRefresh")}</button>
    </div>
    {error && <p className="ai-error" role="alert">{error}</p>}
  </div>;
}
