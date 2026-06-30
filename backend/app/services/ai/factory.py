from app.services.ai.base import LLMProvider
from app.services.ai.openai import OpenAIProvider
from app.services.ai.claude import ClaudeProvider
from app.services.ai.deepseek import DeepSeekProvider


def get_provider(api_key: str, provider_type: str | None = None) -> LLMProvider:
    if provider_type == "claude":
        return ClaudeProvider(api_key=api_key)
    elif provider_type == "deepseek":
        return DeepSeekProvider(api_key=api_key)
    elif provider_type == "openai":
        return OpenAIProvider(api_key=api_key)

    # Auto-detect from key prefix
    if api_key.startswith("sk-ant-"):
        return ClaudeProvider(api_key=api_key)
    elif api_key.startswith("sk-"):
        return OpenAIProvider(api_key=api_key)

    return OpenAIProvider(api_key=api_key)
