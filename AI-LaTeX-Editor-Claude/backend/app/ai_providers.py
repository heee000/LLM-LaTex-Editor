import json
from typing import AsyncIterator

import httpx


class LLMProvider:
    async def chat_stream(self, messages: list[dict], model: str) -> AsyncIterator[str]:
        raise NotImplementedError

    async def vision(self, image_base64: str, prompt: str, model: str) -> str:
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1") -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    async def chat_stream(self, messages: list[dict], model: str) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "stream": True},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: ") or line == "data: [DONE]":
                        continue
                    data = json.loads(line[6:])
                    content = data.get("choices", [{}])[0].get("delta", {}).get("content")
                    if content:
                        yield content

    async def vision(self, image_base64: str, prompt: str, model: str) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
                            ],
                        }
                    ],
                },
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]


class ClaudeProvider(LLMProvider):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def chat_stream(self, messages: list[dict], model: str) -> AsyncIterator[str]:
        system = ""
        user_messages: list[dict] = []
        for message in messages:
            if message.get("role") == "system":
                system = message.get("content", "")
            else:
                user_messages.append({"role": message["role"], "content": message.get("content", "")})

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "system": system,
                    "messages": user_messages,
                    "max_tokens": 4096,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = json.loads(line[6:])
                    if data.get("type") == "content_block_delta":
                        content = data.get("delta", {}).get("text")
                        if content:
                            yield content

    async def vision(self, image_base64: str, prompt: str, model: str) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 4096,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_base64}},
                                {"type": "text", "text": prompt},
                            ],
                        }
                    ],
                },
            )
            response.raise_for_status()
            blocks = response.json().get("content", [])
            return "".join(block.get("text", "") for block in blocks)


class DeepSeekProvider(OpenAIProvider):
    def __init__(self, api_key: str) -> None:
        super().__init__(api_key=api_key, base_url="https://api.deepseek.com/v1")


def get_provider(api_key: str, provider: str | None) -> LLMProvider:
    provider = (provider or "").lower()
    if provider == "claude" or api_key.startswith("sk-ant-"):
        return ClaudeProvider(api_key)
    if provider == "deepseek":
        return DeepSeekProvider(api_key)
    return OpenAIProvider(api_key)
