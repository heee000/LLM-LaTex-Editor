import { useState } from "react";
import { Modal } from "../common/Modal";
import { useSettingsStore } from "../../store";

const MODEL_DEFAULTS: Record<string, string> = { openai: "gpt-4o", claude: "claude-sonnet-4-6", deepseek: "deepseek-chat" };

export function APIKeyModal({ onClose }: { onClose: () => void }) {
  const { llmKey, llmProvider, llmModel, setLLMKey, setLLMModel } = useSettingsStore();
  const [key, setKey] = useState(llmKey);
  const [provider, setProvider] = useState(llmProvider);
  const [model, setModel] = useState(llmModel);

  const handleSave = () => { setLLMKey(key, provider); setLLMModel(model); onClose(); };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-sm font-semibold mb-4">LLM API 设置</h2>
      <p className="text-xs text-stone-500 mb-3">您的 API 密钥仅存储在浏览器本地，除 AI 请求外不会发送至服务器。</p>
      <div className="space-y-2">
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(MODEL_DEFAULTS[e.target.value] || "gpt-4o"); }} className="w-full text-xs border border-stone-300 dark:border-stone-700 rounded-subtle px-2 py-1.5 bg-white dark:bg-stone-800 focus:outline-none focus:ring-1 focus:ring-accent/30">
          <option value="openai">OpenAI</option>
          <option value="claude">Anthropic Claude</option>
          <option value="deepseek">DeepSeek</option>
        </select>
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="模型名称" className="w-full text-xs border border-stone-300 dark:border-stone-700 rounded-subtle px-2 py-1.5 bg-white dark:bg-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-accent/30" />
        <input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder="API 密钥" className="w-full text-xs border border-stone-300 dark:border-stone-700 rounded-subtle px-2 py-1.5 bg-white dark:bg-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-accent/30" />
      </div>
      <button onClick={handleSave} className="w-full mt-3 py-1.5 text-xs rounded-subtle bg-accent text-white hover:bg-accent-hover">保存</button>
    </Modal>
  );
}
