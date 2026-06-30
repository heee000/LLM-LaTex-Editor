from app.services.ai.openai import OpenAIProvider


class DeepSeekProvider(OpenAIProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key=api_key, base_url="https://api.deepseek.com/v1")
