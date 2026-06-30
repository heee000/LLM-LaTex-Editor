from fastapi import Request, HTTPException

async def get_llm_credentials(request: Request) -> tuple[str, str]:
    """Extract LLM API key and provider from request headers. Returns (api_key, provider)."""
    api_key = request.headers.get("X-LLM-Key")
    provider = request.headers.get("X-LLM-Provider", "openai")
    if not api_key:
        raise HTTPException(status_code=400, detail="X-LLM-Key header required for AI operations")
    return api_key, provider

async def get_optional_llm_credentials(request: Request) -> tuple[str | None, str]:
    """Extract LLM API key if present, without failing."""
    api_key = request.headers.get("X-LLM-Key")
    provider = request.headers.get("X-LLM-Provider", "openai")
    return api_key, provider
