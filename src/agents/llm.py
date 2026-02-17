"""DeepSeek LLM factory for CrewAI agents.

Provides a factory function for creating DeepSeek V3.2 LLM instances.
Kept separate from config.py to avoid circular imports (config is imported everywhere).
"""
from crewai import LLM
from src.core.config import settings


def get_deepseek_llm() -> LLM:
    """Factory for DeepSeek V3.2 LLM via OpenAI-compatible endpoint.

    Uses LiteLLM format 'deepseek/deepseek-chat' for provider routing.

    Returns:
        crewai.LLM configured for DeepSeek V3.2 chat model
    """
    return LLM(
        model="openai/deepseek-chat",
        base_url=settings.DEEPSEEK_BASE_URL,
        api_key=settings.DEEPSEEK_API_KEY,
        temperature=0.7,
        max_tokens=2048,
    )
