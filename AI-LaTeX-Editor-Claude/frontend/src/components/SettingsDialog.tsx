import { Check, KeyRound, X } from "lucide-react";
import { useState } from "react";
import { useSettingsStore } from "../store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: Props) {
  const settings = useSettingsStore();
  const [key, setKey] = useState(settings.llmKey);
  const [provider, setProvider] = useState(settings.llmProvider);
  const [model, setModel] = useState(settings.llmModel);

  if (!open) return null;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Model access</p>
            <h2>API 设置</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="form-stack">
          <label>
            <span>Provider</span>
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="openai">OpenAI compatible</option>
              <option value="claude">Claude</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </label>
          <label>
            <span>Model</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4o / claude-sonnet-4-5" />
          </label>
          <label>
            <span>API key</span>
            <div className="input-with-icon">
              <KeyRound size={16} />
              <input
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="只保存在当前浏览器"
              />
            </div>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.autoCompile}
              onChange={(event) => settings.setAutoCompile(event.target.checked)}
            />
            <span>保存后自动编译</span>
          </label>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-button"
            onClick={() => {
              settings.setLLM(key, provider, model);
              onClose();
            }}
          >
            <Check size={16} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
