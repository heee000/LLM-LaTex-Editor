from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMProvider(ABC):
    @abstractmethod
    async def chat_stream(self, messages: list[dict], model: str) -> AsyncIterator[str]:
        """Stream chat completion chunks."""
        ...

    @abstractmethod
    async def vision(self, image_base64: str, prompt: str, model: str) -> str:
        """Process an image with a vision-capable model."""
        ...
